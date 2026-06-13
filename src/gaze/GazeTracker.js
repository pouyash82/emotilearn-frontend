/**
 * GazeTracker.js
 * Core gaze tracking engine for EmotiLearn.
 *
 * Pipeline:
 *   MediaPipe Face Mesh landmarks
 *     → Iris gaze ratios (Rx, Ry)
 *     → Head pose (yaw, pitch via solvePnP-style estimation)
 *     → Gaze fusion (iris + head)
 *     → Calibration transform → screen coordinates
 *     → Kalman filter → smoothed position
 *     → Fixation detection → fixation circle + heatmap data
 *     → Attention score
 *
 * Usage:
 *   const tracker = new GazeTracker(screenWidth, screenHeight);
 *   // During calibration:
 *   tracker.addCalibrationSample(targetX, targetY, landmarks);
 *   tracker.computeCalibration();
 *   // During tracking:
 *   const result = tracker.processLandmarks(landmarks, imageWidth, imageHeight);
 */

import KalmanFilter from './KalmanFilter.js';
import FixationDetector from './FixationDetector.js';

// ─── MediaPipe landmark indices ───
const LANDMARKS = {
  // Iris centers (available when refine_landmarks=true)
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473,

  // Eye corners — MediaPipe's "left" is the face's left (mirrored in selfie cam)
  // For the LEFT eye (face's left = screen right in selfie):
  LEFT_EYE_INNER: 362,
  LEFT_EYE_OUTER: 263,
  LEFT_EYE_TOP: 386,
  LEFT_EYE_BOTTOM: 374,

  // For the RIGHT eye (face's right = screen left in selfie):
  RIGHT_EYE_INNER: 133,
  RIGHT_EYE_OUTER: 33,
  RIGHT_EYE_TOP: 159,
  RIGHT_EYE_BOTTOM: 145,

  // Head pose landmarks (for solvePnP-style estimation)
  NOSE_TIP: 1,
  CHIN: 152,
  LEFT_EYE_CORNER: 263,
  RIGHT_EYE_CORNER: 33,
  LEFT_MOUTH: 287,
  RIGHT_MOUTH: 57,
  FOREHEAD: 10,
};

export default class GazeTracker {
  /**
   * @param {number} screenWidth  - screen width in pixels
   * @param {number} screenHeight - screen height in pixels
   * @param {Object} [opts]
   * @param {number} [opts.kalmanProcess]     - Kalman process noise (default 0.04)
   * @param {number} [opts.kalmanMeasurement] - Kalman measurement noise (default 120)
   * @param {number} [opts.fixationDispersion]  - fixation dispersion threshold px (default 100)
   * @param {number} [opts.fixationMinDuration] - min fixation duration ms (default 150)
   * @param {number} [opts.eyeWeight]           - weight for iris gaze in fusion (default 0.77)
   */
  constructor(screenWidth, screenHeight, opts = {}) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // Fusion weights
    this.eyeWeight = opts.eyeWeight ?? 0.77;
    this.headWeight = 1 - this.eyeWeight;

    // Sub-modules
    this.kalman = new KalmanFilter({
      processNoise: opts.kalmanProcess ?? 0.04,
      measurementNoise: opts.kalmanMeasurement ?? 120,
    });

    this.fixationDetector = new FixationDetector({
      dispersionThreshold: opts.fixationDispersion ?? 100,
      minDuration: opts.fixationMinDuration ?? 150,
    });

    // Calibration state
    this.isCalibrated = false;
    this.calibrationSamples = []; // { targetX, targetY, rx, ry }
    this.calibCoeffsX = null; // polynomial coefficients for X
    this.calibCoeffsY = null; // polynomial coefficients for Y

    // Head pose baseline (set during calibration)
    this.headBaselineYaw = 0;
    this.headBaselinePitch = 0;

    // Attention tracking
    this.onScreenHistory = []; // boolean ring buffer
    this.onScreenHistoryMax = 90; // ~3 seconds at 30fps

    // Heatmap accumulator
    this.heatmapGridW = 48;
    this.heatmapGridH = 27;
    this.heatmap = new Float32Array(this.heatmapGridW * this.heatmapGridH);
    this.heatmapDecay = 0.997; // slow fade per frame
    this.heatmapSigma = 1.5; // Gaussian spread in grid cells

    // State
    this.lastResult = null;
    this.frameCount = 0;
  }

  // ──────────────────────────────────────────────
  //  IRIS GAZE RATIO EXTRACTION
  // ──────────────────────────────────────────────

  /**
   * Extract raw gaze ratios from MediaPipe landmarks.
   * @param {Array} lm - MediaPipe landmarks array (468+ entries, each {x, y, z})
   * @param {number} w  - image width
   * @param {number} h  - image height
   * @returns {{ rx: number, ry: number, confidence: number }}
   */
  _computeGazeRatios(lm, w, h) {
    const pt = (idx) => ({
      x: lm[idx].x * w,
      y: lm[idx].y * h,
    });

    // Right eye (user's right = face's right = MediaPipe indices 33/133 side)
    const rIris = pt(LANDMARKS.RIGHT_IRIS_CENTER);
    const rInner = pt(LANDMARKS.RIGHT_EYE_INNER);
    const rOuter = pt(LANDMARKS.RIGHT_EYE_OUTER);
    const rTop = pt(LANDMARKS.RIGHT_EYE_TOP);
    const rBottom = pt(LANDMARKS.RIGHT_EYE_BOTTOM);

    // Left eye (user's left)
    const lIris = pt(LANDMARKS.LEFT_IRIS_CENTER);
    const lInner = pt(LANDMARKS.LEFT_EYE_INNER);
    const lOuter = pt(LANDMARKS.LEFT_EYE_OUTER);
    const lTop = pt(LANDMARKS.LEFT_EYE_TOP);
    const lBottom = pt(LANDMARKS.LEFT_EYE_BOTTOM);

    // Use min/max for corners to avoid sign error with mirrored camera
    const rLeftX = Math.min(rInner.x, rOuter.x);
    const rRightX = Math.max(rInner.x, rOuter.x);
    const lLeftX = Math.min(lInner.x, lOuter.x);
    const lRightX = Math.max(lInner.x, lOuter.x);

    const rSpanX = rRightX - rLeftX || 1;
    const lSpanX = lRightX - lLeftX || 1;
    const rSpanY = (rBottom.y - rTop.y) || 1;
    const lSpanY = (lBottom.y - lTop.y) || 1;

    // Horizontal ratios (0 = left, 1 = right)
    const rxRight = (rIris.x - rLeftX) / rSpanX;
    const rxLeft = (lIris.x - lLeftX) / lSpanX;

    // Vertical ratios (0 = top, 1 = bottom)
    const ryRight = (rIris.y - rTop.y) / rSpanY;
    const ryLeft = (lIris.y - lTop.y) / lSpanY;

    // Average both eyes
    const rx = (rxRight + rxLeft) / 2;
    const ry = (ryRight + ryLeft) / 2;

    // Confidence: based on eye openness (EAR-like)
    const rEAR = rSpanY / rSpanX;
    const lEAR = lSpanY / lSpanX;
    const avgEAR = (rEAR + lEAR) / 2;
    // If eyes are very closed (blink), confidence drops
    const confidence = Math.min(1, avgEAR / 0.25);

    return { rx: clamp(rx, 0, 1), ry: clamp(ry, 0, 1), confidence };
  }

  // ──────────────────────────────────────────────
  //  HEAD POSE ESTIMATION (simplified, no solvePnP)
  // ──────────────────────────────────────────────

  /**
   * Estimate head yaw and pitch from landmark geometry.
   * This is a simplified approach that avoids needing camera intrinsics.
   * Uses the nose-to-eye-corner ratios as proxy for head rotation.
   */
  _estimateHeadPose(lm, w, h) {
    const pt = (idx) => ({
      x: lm[idx].x * w,
      y: lm[idx].y * h,
      z: lm[idx].z * w, // z is in same scale as x roughly
    });

    const nose = pt(LANDMARKS.NOSE_TIP);
    const leftEye = pt(LANDMARKS.LEFT_EYE_CORNER);
    const rightEye = pt(LANDMARKS.RIGHT_EYE_CORNER);
    const forehead = pt(LANDMARKS.FOREHEAD);
    const chin = pt(LANDMARKS.CHIN);

    // Yaw: ratio of nose-to-left-eye vs nose-to-right-eye distances
    const dLeft = Math.abs(nose.x - leftEye.x);
    const dRight = Math.abs(nose.x - rightEye.x);
    const eyeSpan = Math.abs(leftEye.x - rightEye.x) || 1;

    // Normalized yaw: 0 = facing straight, positive = turned right
    const yawRatio = (dRight - dLeft) / eyeSpan; // range roughly [-1, 1]
    const yaw = yawRatio * 45; // approximate degrees

    // Pitch: vertical position of nose relative to forehead-chin span
    const faceHeight = Math.abs(chin.y - forehead.y) || 1;
    const noseRelative = (nose.y - forehead.y) / faceHeight;
    const pitch = (noseRelative - 0.55) * 90; // 0.55 = neutral nose position

    return { yaw, pitch };
  }

  // ──────────────────────────────────────────────
  //  CALIBRATION
  // ──────────────────────────────────────────────

  /**
   * Add a calibration sample.
   * Call this while the user is looking at a known screen point.
   * @param {number} targetX - known screen X coordinate of calibration dot
   * @param {number} targetY - known screen Y coordinate of calibration dot
   * @param {Array}  lm      - MediaPipe landmarks
   * @param {number} w       - image width
   * @param {number} h       - image height
   */
  addCalibrationSample(targetX, targetY, lm, w, h) {
    const { rx, ry, confidence } = this._computeGazeRatios(lm, w, h);
    if (confidence < 0.3) return; // skip if eyes are closed

    const { yaw, pitch } = this._estimateHeadPose(lm, w, h);

    this.calibrationSamples.push({
      targetX,
      targetY,
      rx,
      ry,
      yaw,
      pitch,
    });
  }

  /**
   * Compute calibration transform from collected samples.
   * Uses 2nd degree polynomial regression.
   * @returns {boolean} true if calibration succeeded
   */
  computeCalibration() {
    const samples = this.calibrationSamples;
    if (samples.length < 9) {
      console.warn(`GazeTracker: need >= 9 calibration samples, got ${samples.length}`);
      return false;
    }

    // Group samples by target point and average the gaze ratios
    const grouped = {};
    for (const s of samples) {
      const key = `${s.targetX},${s.targetY}`;
      if (!grouped[key]) {
        grouped[key] = { targetX: s.targetX, targetY: s.targetY, rxSum: 0, rySum: 0, count: 0 };
      }
      grouped[key].rxSum += s.rx;
      grouped[key].rySum += s.ry;
      grouped[key].count++;
    }

    const points = Object.values(grouped).map((g) => ({
      targetX: g.targetX,
      targetY: g.targetY,
      rx: g.rxSum / g.count,
      ry: g.rySum / g.count,
    }));

    if (points.length < 6) {
      console.warn(`GazeTracker: need >= 6 unique calibration points, got ${points.length}`);
      return false;
    }

    // Fit polynomial: target = a0 + a1*rx + a2*ry + a3*rx² + a4*ry² + a5*rx*ry
    this.calibCoeffsX = this._fitPolynomial(points, 'targetX');
    this.calibCoeffsY = this._fitPolynomial(points, 'targetY');

    // Store head pose baseline
    const yawSum = samples.reduce((s, v) => s + v.yaw, 0);
    const pitchSum = samples.reduce((s, v) => s + v.pitch, 0);
    this.headBaselineYaw = yawSum / samples.length;
    this.headBaselinePitch = pitchSum / samples.length;

    this.isCalibrated = true;
    this.kalman.reset();
    this.fixationDetector.reset();

    console.log('GazeTracker: calibration complete', {
      points: points.length,
      totalSamples: samples.length,
    });

    return true;
  }

  /**
   * Least-squares polynomial regression.
   * Solves: target = a0 + a1*rx + a2*ry + a3*rx² + a4*ry² + a5*rx*ry
   */
  _fitPolynomial(points, targetKey) {
    const n = points.length;

    // Build design matrix A (n x 6) and target vector b (n x 1)
    const A = [];
    const b = [];
    for (const p of points) {
      A.push([1, p.rx, p.ry, p.rx * p.rx, p.ry * p.ry, p.rx * p.ry]);
      b.push(p[targetKey]);
    }

    // Solve normal equations: (A^T A) coeffs = A^T b
    const AT = transpose(A);
    const ATA = matMul(AT, A);
    const ATb = matVecMul(AT, b);

    // Solve using Gaussian elimination
    return solveLinear(ATA, ATb);
  }

  /**
   * Apply calibration polynomial to raw gaze ratios.
   */
  _applyCalibration(rx, ry) {
    if (!this.calibCoeffsX || !this.calibCoeffsY) {
      // Fallback: simple linear mapping if calibration failed
      return {
        x: rx * this.screenWidth,
        y: ry * this.screenHeight,
      };
    }

    const features = [1, rx, ry, rx * rx, ry * ry, rx * ry];
    let sx = 0, sy = 0;
    for (let i = 0; i < 6; i++) {
      sx += this.calibCoeffsX[i] * features[i];
      sy += this.calibCoeffsY[i] * features[i];
    }

    return {
      x: clamp(sx, 0, this.screenWidth),
      y: clamp(sy, 0, this.screenHeight),
    };
  }

  // ──────────────────────────────────────────────
  //  GAZE FUSION
  // ──────────────────────────────────────────────

  _fuseGaze(irisScreen, headPose, confidence) {
    // Head pose → screen offset from baseline
    const headDeltaYaw = headPose.yaw - this.headBaselineYaw;
    const headDeltaPitch = headPose.pitch - this.headBaselinePitch;

    // Convert head delta to approximate screen pixels
    // ~20px per degree is a rough estimate for typical viewing distance
    const pxPerDeg = this.screenWidth / 90; // ~21px/deg on 1920px wide screen
    const headScreenX = this.screenWidth / 2 - headDeltaYaw * pxPerDeg;
    const headScreenY = this.screenHeight / 2 + headDeltaPitch * pxPerDeg;

    // Adaptive fusion: trust iris more when confidence is high
    const adaptiveEyeW = this.eyeWeight * confidence;
    const adaptiveHeadW = 1 - adaptiveEyeW;

    return {
      x: adaptiveEyeW * irisScreen.x + adaptiveHeadW * headScreenX,
      y: adaptiveEyeW * irisScreen.y + adaptiveHeadW * headScreenY,
    };
  }

  // ──────────────────────────────────────────────
  //  HEATMAP
  // ──────────────────────────────────────────────

  _updateHeatmap(screenX, screenY) {
    // Decay existing heatmap
    for (let i = 0; i < this.heatmap.length; i++) {
      this.heatmap[i] *= this.heatmapDecay;
    }

    // Convert screen coords to grid coords
    const gx = (screenX / this.screenWidth) * this.heatmapGridW;
    const gy = (screenY / this.screenHeight) * this.heatmapGridH;

    // Add Gaussian blob
    const r = Math.ceil(this.heatmapSigma * 2.5);
    const s2 = 2 * this.heatmapSigma * this.heatmapSigma;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ix = Math.round(gx + dx);
        const iy = Math.round(gy + dy);
        if (ix < 0 || ix >= this.heatmapGridW || iy < 0 || iy >= this.heatmapGridH) continue;

        const weight = Math.exp(-(dx * dx + dy * dy) / s2);
        this.heatmap[iy * this.heatmapGridW + ix] += weight * 0.3;
      }
    }
  }

  /**
   * Get heatmap as a 2D array for rendering.
   * Values are normalized to [0, 1].
   */
  getHeatmapData() {
    let maxVal = 0;
    for (let i = 0; i < this.heatmap.length; i++) {
      if (this.heatmap[i] > maxVal) maxVal = this.heatmap[i];
    }
    if (maxVal < 0.01) maxVal = 1; // avoid division by zero

    const normalized = new Float32Array(this.heatmap.length);
    for (let i = 0; i < this.heatmap.length; i++) {
      normalized[i] = this.heatmap[i] / maxVal;
    }

    return {
      data: normalized,
      width: this.heatmapGridW,
      height: this.heatmapGridH,
    };
  }

  // ──────────────────────────────────────────────
  //  ATTENTION SCORE
  // ──────────────────────────────────────────────

  _computeAttentionScore(screenX, screenY, fixResult) {
    // 1. OnScreen: is the gaze within screen bounds?
    const onScreen =
      screenX >= -50 &&
      screenX <= this.screenWidth + 50 &&
      screenY >= -50 &&
      screenY <= this.screenHeight + 50;

    this.onScreenHistory.push(onScreen ? 1 : 0);
    if (this.onScreenHistory.length > this.onScreenHistoryMax) {
      this.onScreenHistory.shift();
    }

    const onScreenRatio =
      this.onScreenHistory.reduce((a, b) => a + b, 0) /
      this.onScreenHistory.length;

    // 2. Fixation stability
    const fixStability = fixResult.isFixating
      ? Math.min(1.0, fixResult.duration / 3000) // max out at 3 seconds
      : 0;

    // 3. Saccade rate penalty
    const saccadesPerSec = fixResult.saccadeRate / 10; // rate is count in 10s
    const normalRate = 1.5; // saccades/sec
    const excessRate = 4.0;
    const saccadeScore = Math.max(
      0,
      1.0 - Math.max(0, saccadesPerSec - normalRate) / excessRate
    );

    // Weighted combination
    const score = 0.5 * onScreenRatio + 0.3 * fixStability + 0.2 * saccadeScore;

    return {
      score: clamp(score, 0, 1),
      onScreenRatio,
      fixStability,
      saccadeScore,
      isOnScreen: onScreen,
    };
  }

  // ──────────────────────────────────────────────
  //  MAIN PROCESSING PIPELINE
  // ──────────────────────────────────────────────

  /**
   * Process a frame's MediaPipe landmarks into a complete gaze result.
   *
   * @param {Array} landmarks - MediaPipe face landmarks (468+ points, each {x, y, z})
   *                            These are NORMALIZED coordinates (0-1).
   * @param {number} imageWidth  - webcam frame width in pixels
   * @param {number} imageHeight - webcam frame height in pixels
   * @returns {GazeResult | null} - null if not calibrated or face not detected properly
   */
  processLandmarks(landmarks, imageWidth, imageHeight) {
    if (!landmarks || landmarks.length < 478) {
      return null; // Need iris landmarks (478 total with refine_landmarks)
    }

    this.frameCount++;
    const now = performance.now();

    // Step 1: Extract iris gaze ratios
    const { rx, ry, confidence } = this._computeGazeRatios(
      landmarks,
      imageWidth,
      imageHeight
    );

    // Step 2: Head pose
    const headPose = this._estimateHeadPose(landmarks, imageWidth, imageHeight);

    // Step 3: Map to screen coordinates
    let screenPos;
    if (this.isCalibrated) {
      // Apply calibration polynomial
      const irisScreen = this._applyCalibration(rx, ry);
      // Fuse with head pose
      screenPos = this._fuseGaze(irisScreen, headPose, confidence);
    } else {
      // No calibration: simple linear mapping (poor accuracy but functional)
      screenPos = {
        x: (1 - rx) * this.screenWidth, // Invert X for selfie mirror
        y: ry * this.screenHeight,
      };
    }

    // Step 4: Kalman filter
    const smoothed = this.kalman.update(screenPos.x, screenPos.y, now);

    // Step 5: Fixation detection
    const fixation = this.fixationDetector.addPoint(smoothed.x, smoothed.y, now);

    // Step 6: Update heatmap
    this._updateHeatmap(smoothed.x, smoothed.y);

    // Step 7: Attention score
    const attention = this._computeAttentionScore(smoothed.x, smoothed.y, fixation);

    // Build result
    this.lastResult = {
      // Raw data
      gazeRatio: { rx, ry },
      headPose,
      confidence,

      // Screen position (smoothed)
      x: smoothed.x,
      y: smoothed.y,
      vx: smoothed.vx,
      vy: smoothed.vy,

      // Fixation
      isFixating: fixation.isFixating,
      fixationDuration: fixation.duration,
      fixationHistory: fixation.fixationHistory,
      saccadeRate: fixation.saccadeRate,

      // Attention
      attention,

      // Meta
      timestamp: now,
      frameCount: this.frameCount,
      isCalibrated: this.isCalibrated,
    };

    return this.lastResult;
  }

  // ──────────────────────────────────────────────
  //  UTILITIES
  // ──────────────────────────────────────────────

  /**
   * Clear calibration and reset all tracking state.
   */
  resetCalibration() {
    this.calibrationSamples = [];
    this.calibCoeffsX = null;
    this.calibCoeffsY = null;
    this.isCalibrated = false;
    this.kalman.reset();
    this.fixationDetector.reset();
    this.heatmap.fill(0);
    this.onScreenHistory = [];
    this.lastResult = null;
    this.frameCount = 0;
  }

  /**
   * Clear only the heatmap (e.g., when starting a new session).
   */
  clearHeatmap() {
    this.heatmap.fill(0);
  }

  /**
   * Export calibration coefficients for saving/restoring.
   */
  exportCalibration() {
    if (!this.isCalibrated) return null;
    return {
      coeffsX: Array.from(this.calibCoeffsX),
      coeffsY: Array.from(this.calibCoeffsY),
      baselineYaw: this.headBaselineYaw,
      baselinePitch: this.headBaselinePitch,
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
    };
  }

  /**
   * Import previously saved calibration.
   */
  importCalibration(data) {
    if (!data || !data.coeffsX || !data.coeffsY) return false;
    this.calibCoeffsX = data.coeffsX;
    this.calibCoeffsY = data.coeffsY;
    this.headBaselineYaw = data.baselineYaw ?? 0;
    this.headBaselinePitch = data.baselinePitch ?? 0;
    this.screenWidth = data.screenWidth ?? this.screenWidth;
    this.screenHeight = data.screenHeight ?? this.screenHeight;
    this.isCalibrated = true;
    this.kalman.reset();
    this.fixationDetector.reset();
    return true;
  }
}

// ──────────────────────────────────────────────
//  Math helpers (no external dependency needed)
// ──────────────────────────────────────────────

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function transpose(A) {
  const rows = A.length, cols = A[0].length;
  const T = [];
  for (let j = 0; j < cols; j++) {
    T[j] = [];
    for (let i = 0; i < rows; i++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

function matMul(A, B) {
  const rA = A.length, cA = A[0].length, cB = B[0].length;
  const C = Array.from({ length: rA }, () => new Array(cB).fill(0));
  for (let i = 0; i < rA; i++) {
    for (let j = 0; j < cB; j++) {
      for (let k = 0; k < cA; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

function matVecMul(A, v) {
  return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
}

/**
 * Solve Ax = b using Gaussian elimination with partial pivoting.
 * Returns x as an array.
 */
function solveLinear(A, b) {
  const n = b.length;
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / (M[col][col] || 1e-12);
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i] || 1e-12;
  }

  return x;
}
