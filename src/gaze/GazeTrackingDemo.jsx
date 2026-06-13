/**
 * GazeTrackingDemo.jsx
 * 
 * Complete demo page showing the Tobii-like gaze visualization.
 * Drop this into your React app to test the full pipeline.
 *
 * This page:
 *   1. Activates webcam
 *   2. Runs MediaPipe Face Mesh (with iris landmarks)
 *   3. Offers calibration
 *   4. Shows the fixation circle + heatmap overlay
 *   5. Displays real-time attention score
 *
 * Integration with EmotiLearn:
 *   - This is a standalone demo. To integrate into your existing pages
 *     (e.g., TeacherDashboard or student lecture view), extract the
 *     useGazeTracking hook and GazeOverlay component.
 *   - If you already run MediaPipe Face Mesh somewhere, use the
 *     `updateLandmarks()` function from the hook to pipe your existing
 *     landmarks into the gaze tracker.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import useGazeTracking from './useGazeTracking.js';
import GazeCalibration from './GazeCalibration.jsx';
import GazeOverlay from './GazeOverlay.jsx';

export default function GazeTrackingDemo() {
  const videoRef = useRef(null);
  const [showWebcam, setShowWebcam] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCircle, setShowCircle] = useState(true);
  const [showScanpath, setShowScanpath] = useState(false);
  const [showDebug, setShowDebug] = useState(true);

  const {
    gazeResult,
    gazeTracker,
    isTracking,
    isCalibrated,
    isCalibrating,
    startTracking,
    stopTracking,
    startCalibration,
    cancelCalibration,
    onCalibrationComplete,
    getLandmarks,
  } = useGazeTracking(videoRef);

  // Start webcam on mount
  useEffect(() => {
    const initWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error('Failed to access webcam:', e);
      }
    };

    initWebcam();

    return () => {
      // Cleanup webcam
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleClearHeatmap = () => {
    gazeTracker?.clearHeatmap();
  };

  const handleRecalibrate = () => {
    startCalibration();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      {/* ─── Gaze Overlay (renders on top of everything) ─── */}
      <GazeOverlay
        gazeResult={gazeResult}
        gazeTracker={gazeTracker}
        visible={isTracking && !isCalibrating}
        showHeatmap={showHeatmap}
        showCircle={showCircle}
        showScanpath={showScanpath}
        opacity={0.55}
      />

      {/* ─── Calibration Overlay ─── */}
      {isCalibrating && (
        <GazeCalibration
          gazeTracker={gazeTracker}
          getLandmarks={getLandmarks}
          onComplete={onCalibrationComplete}
          onCancel={cancelCalibration}
        />
      )}

      {/* ─── Main Content ─── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">
              👁️ EmotiLearn Gaze Tracker
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Tobii-style attention visualization using standard webcam
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Status indicators */}
            <StatusBadge
              label="Webcam"
              active={videoRef.current?.srcObject != null}
            />
            <StatusBadge label="Tracking" active={isTracking} />
            <StatusBadge
              label="Calibrated"
              active={isCalibrated}
              color="green"
            />
          </div>
        </div>

        {/* Control Panel + Webcam Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gray-900 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                Controls
              </h3>

              {/* Start/Stop */}
              <button
                onClick={isTracking ? stopTracking : startTracking}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isTracking
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {isTracking ? '⏹ Stop Tracking' : '▶ Start Tracking'}
              </button>

              {/* Calibrate */}
              <button
                onClick={handleRecalibrate}
                disabled={!isTracking}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                🎯 {isCalibrated ? 'Recalibrate' : 'Calibrate'} (9-point)
              </button>

              {/* Clear heatmap */}
              <button
                onClick={handleClearHeatmap}
                className="w-full py-2.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                🗑 Clear Heatmap
              </button>
            </div>

            {/* Toggles */}
            <div className="bg-gray-900 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                Layers
              </h3>
              <Toggle
                label="Fixation Circle"
                checked={showCircle}
                onChange={setShowCircle}
              />
              <Toggle
                label="Heatmap"
                checked={showHeatmap}
                onChange={setShowHeatmap}
              />
              <Toggle
                label="Scanpath (teacher)"
                checked={showScanpath}
                onChange={setShowScanpath}
              />
              <Toggle
                label="Webcam preview"
                checked={showWebcam}
                onChange={setShowWebcam}
              />
              <Toggle
                label="Debug info"
                checked={showDebug}
                onChange={setShowDebug}
              />
            </div>
          </div>

          {/* Webcam preview + debug */}
          <div className="lg:col-span-2 space-y-4">
            {/* Webcam */}
            <div
              className={`bg-gray-900 rounded-xl overflow-hidden ${
                showWebcam ? '' : 'hidden'
              }`}
            >
              <video
                ref={videoRef}
                className="w-full max-h-[360px] object-cover"
                playsInline
                muted
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>

            {/* Hidden video element (if webcam preview is off) */}
            {!showWebcam && (
              <video
                ref={videoRef}
                className="hidden"
                playsInline
                muted
              />
            )}

            {/* Debug panel */}
            {showDebug && gazeResult && (
              <div className="bg-gray-900 rounded-xl p-5">
                <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">
                  Real-time Data
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <DebugStat
                    label="Gaze X"
                    value={`${gazeResult.x?.toFixed(0) ?? '-'}px`}
                  />
                  <DebugStat
                    label="Gaze Y"
                    value={`${gazeResult.y?.toFixed(0) ?? '-'}px`}
                  />
                  <DebugStat
                    label="Confidence"
                    value={`${((gazeResult.confidence ?? 0) * 100).toFixed(0)}%`}
                  />
                  <DebugStat
                    label="Fixating"
                    value={gazeResult.isFixating ? '✅ Yes' : '❌ No'}
                  />
                  <DebugStat
                    label="Fix Duration"
                    value={`${(gazeResult.fixationDuration / 1000).toFixed(1)}s`}
                  />
                  <DebugStat
                    label="Head Yaw"
                    value={`${gazeResult.headPose?.yaw?.toFixed(1) ?? '-'}°`}
                  />
                  <DebugStat
                    label="Saccade Rate"
                    value={`${gazeResult.saccadeRate ?? 0}/10s`}
                  />
                  <DebugStat
                    label="Iris Rx"
                    value={gazeResult.gazeRatio?.rx?.toFixed(3) ?? '-'}
                  />
                </div>

                {/* Attention score */}
                {gazeResult.attention && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">
                        Attention Score
                      </span>
                      <span className="text-lg font-mono font-semibold">
                        {(gazeResult.attention.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${gazeResult.attention.score * 100}%`,
                          backgroundColor: getScoreColor(
                            gazeResult.attention.score
                          ),
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                      <span>
                        On-screen:{' '}
                        {(gazeResult.attention.onScreenRatio * 100).toFixed(0)}%
                      </span>
                      <span>
                        Fixation:{' '}
                        {(gazeResult.attention.fixStability * 100).toFixed(0)}%
                      </span>
                      <span>
                        Saccade:{' '}
                        {(gazeResult.attention.saccadeScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sample content to look at (so the heatmap has something to show) */}
        <div className="bg-gray-900 rounded-xl p-8 space-y-4">
          <h2 className="text-xl font-semibold">
            Sample Lecture Content
          </h2>
          <p className="text-gray-300 leading-relaxed">
            This is placeholder content representing a lecture or learning
            material. As you read this text, the gaze tracker will follow your
            eye position and build a heatmap showing which areas you focused on
            most. The fixation circle will shrink as you dwell on specific words
            or sections, and expand again as your eyes move between areas.
          </p>
          <p className="text-gray-300 leading-relaxed">
            In a real deployment, this area would contain slides, video, or
            interactive course material. The attention score in the debug panel
            above combines on-screen ratio, fixation stability, and saccade rate
            to produce a single engagement metric between 0 and 100%.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">📊</div>
              <p className="text-sm text-gray-400">Slide Content A</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">📈</div>
              <p className="text-sm text-gray-400">Slide Content B</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">🧠</div>
              <p className="text-sm text-gray-400">Slide Content C</p>
            </div>
          </div>
        </div>

        {/* Integration instructions */}
        <div className="mt-8 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">
            Integration Notes
          </h3>
          <ul className="text-sm text-gray-400 space-y-2">
            <li>
              <strong className="text-gray-300">Existing MediaPipe:</strong>{' '}
              If you already run Face Mesh, call{' '}
              <code className="text-blue-400">updateLandmarks(landmarks)</code>{' '}
              from your existing onResults callback instead of starting a
              new Face Mesh instance.
            </li>
            <li>
              <strong className="text-gray-300">Engagement score:</strong>{' '}
              Access <code className="text-blue-400">gazeResult.attention.score</code>{' '}
              and integrate it into your existing engagement formula with weight 0.35.
            </li>
            <li>
              <strong className="text-gray-300">Backend sync:</strong>{' '}
              Send attention data to your FastAPI backend via the existing
              session/frame endpoints. Add attention_score to your frame data model.
            </li>
            <li>
              <strong className="text-gray-300">CCTV mode:</strong>{' '}
              For Hetzner, use only the head pose data (gazeResult.headPose)
              since iris-based gaze is not meaningful from CCTV distance.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Sub-components
// ──────────────────────────────────────────────

function StatusBadge({ label, active, color = 'blue' }) {
  const colors = {
    blue: active ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-800 text-gray-500 border-gray-700',
    green: active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-800 text-gray-500 border-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${colors[color]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? (color === 'green' ? 'bg-green-400' : 'bg-blue-400') : 'bg-gray-600'
        }`}
      />
      {label}
    </span>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${
            checked ? 'bg-blue-600' : 'bg-gray-700'
          }`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${
              checked ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </div>
      </div>
    </label>
  );
}

function DebugStat({ label, value }) {
  return (
    <div>
      <span className="text-gray-500 text-xs block">{label}</span>
      <span className="font-mono text-gray-200">{value}</span>
    </div>
  );
}

function getScoreColor(score) {
  if (score >= 0.7) return '#22c55e';
  if (score >= 0.4) return '#eab308';
  return '#ef4444';
}
