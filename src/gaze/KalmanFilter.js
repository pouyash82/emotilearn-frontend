/**
 * KalmanFilter.js
 * 2D Kalman filter for smoothing gaze position estimates.
 * State vector: [x, y, vx, vy] (position + velocity)
 * 
 * Tuning guide:
 *   - Lower processNoise (Q) = smoother but slower to follow real movement
 *   - Lower measurementNoise (R) = more responsive but jittery
 *   - For gaze tracking: Q=0.04, R=120 is a good starting point
 */
export default class KalmanFilter {
  constructor({ processNoise = 0.04, measurementNoise = 120 } = {}) {
    this.Q = processNoise;
    this.R = measurementNoise;

    // State: [x, y, vx, vy]
    this.x = new Float64Array(4);

    // Covariance matrix (4x4, stored flat for speed)
    this.P = new Float64Array(16);
    this._initCovariance(1000);

    this.initialized = false;
    this.lastTime = null;
  }

  _initCovariance(value) {
    this.P.fill(0);
    this.P[0] = value;   // P[0][0]
    this.P[5] = value;   // P[1][1]
    this.P[10] = value;  // P[2][2]
    this.P[15] = value;  // P[3][3]
  }

  // P is stored row-major: P[row * 4 + col]
  _p(r, c) { return this.P[r * 4 + c]; }
  _setP(r, c, v) { this.P[r * 4 + c] = v; }

  reset() {
    this.x.fill(0);
    this._initCovariance(1000);
    this.initialized = false;
    this.lastTime = null;
  }

  /**
   * @param {number} mx - measured x (screen pixels)
   * @param {number} my - measured y (screen pixels)
   * @param {number} [timestamp] - time in ms (defaults to performance.now())
   * @returns {{ x: number, y: number, vx: number, vy: number }}
   */
  update(mx, my, timestamp) {
    const now = timestamp ?? performance.now();

    if (!this.initialized) {
      this.x[0] = mx;
      this.x[1] = my;
      this.x[2] = 0;
      this.x[3] = 0;
      this.lastTime = now;
      this.initialized = true;
      return { x: mx, y: my, vx: 0, vy: 0 };
    }

    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;

    // === PREDICT ===
    // x' = F * x  (constant velocity model)
    this.x[0] += this.x[2] * dt;
    this.x[1] += this.x[3] * dt;

    // P' = F * P * F' + Q
    // For constant velocity F, this expands to:
    this._setP(0, 0, this._p(0, 0) + 2 * dt * this._p(2, 0) + dt * dt * this._p(2, 2) + this.Q);
    this._setP(1, 1, this._p(1, 1) + 2 * dt * this._p(3, 1) + dt * dt * this._p(3, 3) + this.Q);
    this._setP(2, 2, this._p(2, 2) + this.Q);
    this._setP(3, 3, this._p(3, 3) + this.Q);

    // === UPDATE ===
    // Innovation
    const ix = mx - this.x[0];
    const iy = my - this.x[1];

    // Kalman gain (only for position measurements)
    const Sx = this._p(0, 0) + this.R;
    const Sy = this._p(1, 1) + this.R;
    const Kx0 = this._p(0, 0) / Sx;
    const Ky1 = this._p(1, 1) / Sy;
    const Kx2 = this._p(2, 0) / Sx; // velocity gain from position measurement
    const Ky3 = this._p(3, 1) / Sy;

    // State update
    this.x[0] += Kx0 * ix;
    this.x[1] += Ky1 * iy;
    this.x[2] += Kx2 * ix;
    this.x[3] += Ky3 * iy;

    // Covariance update
    this._setP(0, 0, (1 - Kx0) * this._p(0, 0));
    this._setP(1, 1, (1 - Ky1) * this._p(1, 1));
    this._setP(2, 2, this._p(2, 2) - Kx2 * this._p(0, 2));
    this._setP(3, 3, this._p(3, 3) - Ky3 * this._p(1, 3));

    return {
      x: this.x[0],
      y: this.x[1],
      vx: this.x[2],
      vy: this.x[3],
    };
  }
}
