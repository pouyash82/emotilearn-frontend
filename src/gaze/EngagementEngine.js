/**
 * EngagementEngine.js
 * =====================
 * Frontend port of the three-dimensional engagement engine.
 *
 * Framework: Fredricks, Blumenfeld & Paris (2004)
 *   Dimension 1: Emotional Engagement  (face + voice + text → how they feel)
 *   Dimension 2: Behavioral Engagement (gaze + head pose → what they do)
 *   Dimension 3: Cognitive Engagement  (cross-signal inference → how they think)
 *
 * All existing signals (face emotion, voice, text) keep their FULL weight
 * within the Emotional dimension. Gaze/attention signals have their OWN
 * dimension (Behavioral). Nothing is reduced.
 *
 * Usage:
 *   import EngagementEngine from './gaze/EngagementEngine';
 *   const engine = new EngagementEngine();
 *
 *   // Call every frame with whatever signals you have:
 *   const result = engine.update({
 *     faceEmotion: 'neutral',
 *     faceConfidence: 0.82,
 *     voiceValence: 0.3,
 *     textSentiment: null,
 *     gazeOnScreen: true,
 *     fixationStability: 0.6,
 *     saccadeRate: 1.2,
 *     headYaw: 5.3,
 *     headStability: 0.85,
 *     attentionScore: 0.72,
 *   });
 */

// Emotion-to-engagement base scores (YOUR EXISTING values, unchanged)
const EMOTION_SCORES = {
  happiness: 0.85,
  surprise: 0.80,
  anger: 0.65,
  fear: 0.55,
  disgust: 0.50,
  sadness: 0.35,
  neutral: 0.30,
};

const DIMENSION_WEIGHTS = {
  emotional: 0.35,
  behavioral: 0.40,
  cognitive: 0.25,
};

const EMA_ALPHA = 0.25;
const HISTORY_MAX = 90;

export default class EngagementEngine {
  constructor(weights = DIMENSION_WEIGHTS) {
    this.weights = weights;

    // Smoothed scores
    this._ema = { emotional: 0.5, behavioral: 0.5, cognitive: 0.5, overall: 0.5 };

    // History for trend
    this._history = [];

    // Streak tracking
    this._lastEmotion = null;
    this._emotionStreak = 0;
    this._recentEmotions = [];

    // Cached infrequent signals
    this._lastVoice = null;
    this._lastText = null;

    this._frameCount = 0;
  }

  /**
   * Process one frame of signals.
   * All fields are optional — pass null/undefined for unavailable signals.
   */
  update({
    faceEmotion = null,
    faceConfidence = 0,
    faceProbabilities = null,
    voiceValence = null,
    voiceArousal = null,
    textSentiment = null,
    gazeOnScreen = null,
    fixationStability = null,
    saccadeRate = null,
    headYaw = null,
    headPitch = null,
    headStability = null,
    attentionScore = null,
    blinkRate = null,
  } = {}) {
    this._frameCount++;

    // Cache infrequent signals
    if (voiceValence != null) this._lastVoice = voiceValence;
    if (textSentiment != null) this._lastText = textSentiment;

    // Dimension 1: Emotional
    const [emotional, eBrk] = this._emotional(
      faceEmotion, faceConfidence, faceProbabilities,
      this._lastVoice, voiceArousal, this._lastText
    );

    // Dimension 2: Behavioral
    const [behavioral, bBrk, hasBehavioral] = this._behavioral(
      gazeOnScreen, fixationStability, saccadeRate,
      headYaw, headPitch, headStability, attentionScore, blinkRate
    );

    // Dimension 3: Cognitive
    const [cognitive, cBrk] = this._cognitive(
      emotional, behavioral, faceEmotion, faceConfidence,
      fixationStability, saccadeRate
    );

    // EMA smoothing
    const a = EMA_ALPHA;
    this._ema.emotional = a * emotional + (1 - a) * this._ema.emotional;
    this._ema.behavioral = a * behavioral + (1 - a) * this._ema.behavioral;
    this._ema.cognitive = a * cognitive + (1 - a) * this._ema.cognitive;

    // Adaptive dimension weights: if no gaze/behavioral signals,
    // redistribute behavioral weight to emotional + cognitive
    let wE = this.weights.emotional;
    let wB = this.weights.behavioral;
    let wC = this.weights.cognitive;
    if (!hasBehavioral) {
      // No gaze data — use only emotional + cognitive
      wE = 0.60;
      wB = 0.0;
      wC = 0.40;
    }

    // Overall
    const overall = clamp(
      wE * this._ema.emotional +
      wB * this._ema.behavioral +
      wC * this._ema.cognitive,
      0, 1
    );
    this._ema.overall = a * overall + (1 - a) * this._ema.overall;

    // Trend
    this._history.push(this._ema.overall);
    if (this._history.length > HISTORY_MAX) this._history.shift();
    const [trend, slope] = this._trend();

    // State
    const state = this._classify(
      this._ema.emotional, this._ema.behavioral, this._ema.cognitive,
      faceEmotion, trend
    );

    return {
      emotionalScore: round4(this._ema.emotional),
      behavioralScore: round4(this._ema.behavioral),
      cognitiveScore: round4(this._ema.cognitive),
      overallEngagement: round4(this._ema.overall),
      engagementState: state,
      trend,
      trendSlope: round4(slope),
      breakdown: { emotional: eBrk, behavioral: bBrk, cognitive: cBrk },
    };
  }

  // ─── Dimension 1: Emotional ───────────────────────────────

  _emotional(emotion, confidence, probs, voice, voiceArousal, text) {
    const c = {}, w = {};

    if (emotion) {
      const em = emotion.toLowerCase();
      c.face_base = EMOTION_SCORES[em] ?? 0.50;
      w.face_base = 0.40;

      // Streak
      if (em === this._lastEmotion) this._emotionStreak++;
      else { this._emotionStreak = 0; this._lastEmotion = em; }
      this._recentEmotions.push(em);
      if (this._recentEmotions.length > 30) this._recentEmotions.shift();
    }

    if (confidence > 0) {
      c.confidence = clamp(0.5 + (confidence - 0.5) * 0.8, 0, 1);
      w.confidence = 0.10;
    }

    if (voice != null) {
      let vs = voice >= 0 ? 0.5 + voice * 0.5 : 0.5 + voice * 0.25;
      if (voiceArousal != null) vs = 0.6 * vs + 0.4 * voiceArousal;
      c.voice = clamp(vs, 0, 1);
      w.voice = 0.20;
    }

    if (text != null) {
      c.text = clamp(0.5 + text * 0.4, 0, 1);
      w.text = 0.10;
    }

    if (probs && probs.neutral != null) {
      c.expressivity = clamp(0.3 + (1 - probs.neutral) * 0.7, 0, 1);
      w.expressivity = 0.10;
    } else if (emotion) {
      c.expressivity = emotion.toLowerCase() !== 'neutral' ? 0.7 : 0.3;
      w.expressivity = 0.10;
    }

    if (this._recentEmotions.length >= 5) {
      const unique = new Set(this._recentEmotions).size;
      c.variety = clamp(0.2 + (unique / 7) * 0.6, 0, 1);
      w.variety = 0.10;
    }

    let score = weightedCombine(c, w);

    if (this._emotionStreak > 15) {
      score = Math.max(0, score - Math.min(0.15, (this._emotionStreak - 15) * 0.005));
    }

    return [clamp(score, 0, 1), roundObj(c)];
  }

  // ─── Dimension 2: Behavioral ──────────────────────────────

  _behavioral(onScreen, fixStab, saccRate, yaw, pitch, headStab, attnScore, blink) {
    const c = {}, w = {};

    if (attnScore != null) {
      c.gaze_attention = clamp(attnScore, 0, 1);
      w.gaze_attention = 0.55;
    } else {
      if (onScreen != null) { c.on_screen = onScreen ? 1.0 : 0.2; w.on_screen = 0.25; }
      if (fixStab != null) { c.fixation = clamp(fixStab, 0, 1); w.fixation = 0.20; }
      if (saccRate != null) {
        c.saccade = clamp(Math.max(0, 1 - Math.abs(saccRate - 2.5) / 4), 0, 1);
        w.saccade = 0.10;
      }
    }

    if (yaw != null) {
      const ya = Math.abs(yaw);
      let ds = ya < 15 ? 1 - ya / 15 * 0.15
             : ya < 30 ? 0.85 - (ya - 15) / 15 * 0.35
             : Math.max(0.1, 0.5 - (ya - 30) / 60);
      if (pitch != null) ds = Math.max(0, ds - Math.min(0.2, Math.abs(pitch) / 90 * 0.3));
      c.head_direction = clamp(ds, 0, 1);
      w.head_direction = 0.20;
    }

    if (headStab != null) { c.head_stability = clamp(headStab, 0, 1); w.head_stability = 0.15; }

    if (blink != null) {
      let bs;
      if (blink >= 10 && blink <= 25) bs = 0.8 + 0.2 * (1 - Math.abs(blink - 17.5) / 7.5);
      else if (blink > 25) bs = Math.max(0.2, 0.8 - (blink - 25) / 30);
      else bs = Math.max(0.3, 0.8 - (10 - blink) / 15);
      c.blink_rate = clamp(bs, 0, 1);
      w.blink_rate = 0.10;
    }

    const hasSignals = Object.keys(c).length > 0;
    return [clamp(weightedCombine(c, w), 0, 1), roundObj(c), hasSignals];
  }

  // ─── Dimension 3: Cognitive ───────────────────────────────

  _cognitive(emotional, behavioral, emotion, confidence, fixStab, saccRate) {
    const c = {};

    // Cross-signal coherence
    const coherence = 1 - Math.abs(emotional - behavioral);
    const base = Math.min(emotional, behavioral);
    c.coherence = 0.4 * coherence + 0.6 * base;

    // Emotion-specific patterns
    const fix = fixStab ?? 0.5;
    let ep = 0.5;
    if (emotion) {
      const em = emotion.toLowerCase();
      if (em === 'neutral' && fix > 0.6) ep = 0.65 + fix * 0.25;
      else if (em === 'neutral' && fix < 0.3) ep = 0.2 + fix * 0.3;
      else if ((em === 'fear' || em === 'surprise') && fix > 0.5) ep = 0.7 + fix * 0.2;
      else if (em === 'happiness' && fix > 0.5) ep = 0.75 + fix * 0.2;
      else if (em === 'happiness' && fix < 0.3) ep = 0.3;
      else if (em === 'anger' && fix > 0.5) ep = 0.6 + fix * 0.15;
      else if (em === 'sadness') ep = 0.25 + fix * 0.2;
      else if (em === 'disgust') ep = 0.3 + fix * 0.15;
    }
    c.emotion_pattern = clamp(ep, 0, 1);

    if (saccRate != null) {
      const pr = saccRate >= 1.5 && saccRate <= 4
        ? 0.7 + 0.3 * (1 - Math.abs(saccRate - 2.8) / 1.5)
        : Math.max(0.2, 0.6 - Math.abs(saccRate - 2.8) / 5);
      c.processing_depth = clamp(pr, 0, 1);
    }

    if (confidence > 0) {
      c.investment = clamp(0.3 + confidence * 0.5, 0, 1);
    }

    const cw = { coherence: 0.30, emotion_pattern: 0.35, processing_depth: 0.20, investment: 0.15 };
    const active = {};
    for (const k of Object.keys(c)) if (k in cw) active[k] = cw[k];

    return [clamp(weightedCombine(c, active), 0, 1), roundObj(c)];
  }

  // ─── State Classification ─────────────────────────────────

  _classify(em, bh, cg, emotion, trend) {
    const e = (emotion || 'neutral').toLowerCase();

    if (em > 0.7 && bh > 0.7 && cg > 0.7) return 'Flow';
    if (bh > 0.65 && cg > 0.65 && em > 0.4) return 'Active Learning';
    if (bh > 0.65 && em > 0.35) return 'Attentive';
    if (em > 0.65 && cg > 0.5 && (e === 'surprise' || e === 'happiness')) return 'Curious';
    if (cg > 0.55 && bh > 0.5 && ['fear', 'anger', 'neutral'].includes(e) && em < 0.55)
      return 'Productive Struggle';
    if (bh > 0.35 && bh < 0.65 && em > 0.3 && em < 0.6) return 'Receptive';
    if (bh > 0.5 && cg < 0.4 && ['fear', 'surprise', 'disgust'].includes(e)) return 'Confusion';
    if (em < 0.35 && bh < 0.5 && (e === 'neutral' || e === 'sadness')) return 'Boredom';
    if (trend === 'falling' && em < 0.4 && bh < 0.45) return 'Fatigue';
    if (em < 0.3 && bh < 0.35 && cg < 0.35) return 'Disengagement';
    return 'Receptive';
  }

  // ─── Trend ────────────────────────────────────────────────

  _trend() {
    const h = this._history;
    const n = h.length;
    if (n < 10) return ['stable', 0];

    const xm = (n - 1) / 2;
    const ym = h.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xm) * (h[i] - ym);
      den += (i - xm) ** 2;
    }
    const slope = num / (den || 1);

    if (slope > 0.002) return ['rising', slope];
    if (slope < -0.002) return ['falling', slope];
    return ['stable', slope];
  }

  // ─── API ──────────────────────────────────────────────────

  reset() {
    this._ema = { emotional: 0.5, behavioral: 0.5, cognitive: 0.5, overall: 0.5 };
    this._history = [];
    this._lastEmotion = null;
    this._emotionStreak = 0;
    this._recentEmotions = [];
    this._lastVoice = null;
    this._lastText = null;
    this._frameCount = 0;
  }

  getDimensions() {
    return { ...this._ema };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function round4(v) { return Math.round(v * 10000) / 10000; }
function roundObj(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) r[k] = Math.round(v * 1000) / 1000;
  return r;
}

function weightedCombine(components, weights) {
  const active = Object.keys(components).filter(k => k in weights);
  if (!active.length) return 0.5;
  const totalW = active.reduce((s, k) => s + weights[k], 0);
  if (totalW < 0.01) return 0.5;
  return active.reduce((s, k) => s + (weights[k] / totalW) * components[k], 0);
}
