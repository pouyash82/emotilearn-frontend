/**
 * FixationDetector.js
 * Implements the I-DT (Identification by Dispersion Threshold) algorithm
 * for classifying gaze samples into fixations and saccades.
 *
 * Reference: Salvucci & Goldberg (2000), "Identifying Fixations and Saccades
 * in Eye-Tracking Protocols"
 */
export default class FixationDetector {
  /**
   * @param {Object} opts
   * @param {number} opts.dispersionThreshold - max spatial spread (px) for a fixation (default 100)
   * @param {number} opts.minDuration         - min fixation duration in ms (default 150)
   * @param {number} opts.maxWindowSize       - max points kept in sliding window (default 300)
   */
  constructor({
    dispersionThreshold = 100,
    minDuration = 150,
    maxWindowSize = 300,
  } = {}) {
    this.dispersionThreshold = dispersionThreshold;
    this.minDuration = minDuration;
    this.maxWindowSize = maxWindowSize;
    this.window = [];

    // Current fixation state
    this.fixating = false;
    this.fixationStart = 0;
    this.fixationCenter = { x: 0, y: 0 };

    // Saccade tracking
    this.saccadeCount = 0;
    this.saccadeTimestamps = [];

    // Completed fixation history (last N fixations for scanpath)
    this.fixationHistory = [];
    this.maxHistory = 50;
  }

  /**
   * Feed a new gaze point.
   * @param {number} x - screen x coordinate
   * @param {number} y - screen y coordinate
   * @param {number} timestamp - time in ms
   * @returns {FixationResult}
   */
  addPoint(x, y, timestamp) {
    this.window.push({ x, y, t: timestamp });

    // Prevent unbounded growth
    if (this.window.length > this.maxWindowSize) {
      this.window.shift();
    }

    // Clean old saccade timestamps (keep last 10 seconds)
    this.saccadeTimestamps = this.saccadeTimestamps.filter(
      (t) => timestamp - t < 10000
    );

    return this._evaluate(timestamp);
  }

  _evaluate(now) {
    const w = this.window;
    if (w.length < 2) {
      return this._makeResult(w[0]?.x ?? 0, w[0]?.y ?? 0, 0, false, now);
    }

    // Compute dispersion of current window
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;

    for (const p of w) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      sumX += p.x;
      sumY += p.y;
    }

    const dispersion = (maxX - minX) + (maxY - minY);
    const duration = w[w.length - 1].t - w[0].t;

    if (dispersion <= this.dispersionThreshold) {
      // Points are clustered — potential fixation
      if (duration >= this.minDuration) {
        const cx = sumX / w.length;
        const cy = sumY / w.length;

        if (!this.fixating) {
          // New fixation started
          this.fixating = true;
          this.fixationStart = w[0].t;
        }

        this.fixationCenter = { x: cx, y: cy };
        const fixDuration = now - this.fixationStart;

        return this._makeResult(cx, cy, fixDuration, true, now);
      }

      // Not long enough yet — still accumulating
      return this._makeResult(
        sumX / w.length,
        sumY / w.length,
        0,
        false,
        now
      );
    } else {
      // Dispersion exceeded — this is a saccade

      if (this.fixating) {
        // Fixation just ended — record it
        const fixDuration = now - this.fixationStart;
        this._recordFixation(this.fixationCenter, fixDuration, this.fixationStart);
        this.fixating = false;

        // Count the saccade
        this.saccadeCount++;
        this.saccadeTimestamps.push(now);
      }

      // Shrink window from the front until dispersion is within threshold
      // or window is too small
      while (w.length > 2) {
        w.shift();
        let mi = Infinity, ma = -Infinity, miy = Infinity, may = -Infinity;
        for (const p of w) {
          if (p.x < mi) mi = p.x;
          if (p.x > ma) ma = p.x;
          if (p.y < miy) miy = p.y;
          if (p.y > may) may = p.y;
        }
        if ((ma - mi) + (may - miy) <= this.dispersionThreshold) break;
      }

      const last = w[w.length - 1];
      return this._makeResult(last.x, last.y, 0, false, now);
    }
  }

  _recordFixation(center, duration, startTime) {
    this.fixationHistory.push({
      x: center.x,
      y: center.y,
      duration,
      startTime,
    });
    if (this.fixationHistory.length > this.maxHistory) {
      this.fixationHistory.shift();
    }
  }

  _makeResult(x, y, duration, isFixating, now) {
    return {
      x,
      y,
      duration,
      isFixating,
      saccadeRate: this.saccadeTimestamps.length, // saccades in last 10 sec
      fixationHistory: this.fixationHistory,
      timestamp: now,
    };
  }

  /**
   * Get saccades per second over the last 10 seconds.
   */
  getSaccadeRate() {
    return this.saccadeTimestamps.length / 10;
  }

  /**
   * Reset all state.
   */
  reset() {
    this.window = [];
    this.fixating = false;
    this.fixationStart = 0;
    this.fixationCenter = { x: 0, y: 0 };
    this.saccadeCount = 0;
    this.saccadeTimestamps = [];
    this.fixationHistory = [];
  }
}

/**
 * @typedef {Object} FixationResult
 * @property {number}  x           - current gaze / fixation center x
 * @property {number}  y           - current gaze / fixation center y
 * @property {number}  duration    - current fixation duration (ms), 0 if saccade
 * @property {boolean} isFixating  - true if currently in a fixation
 * @property {number}  saccadeRate - saccade count in last 10 seconds
 * @property {Array}   fixationHistory - recent completed fixations
 * @property {number}  timestamp   - time of this result
 */
