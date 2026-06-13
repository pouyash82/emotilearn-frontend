/**
 * GazeCalibration.jsx
 * Full-screen calibration overlay for gaze tracking.
 *
 * Shows 9 dots in a 3×3 grid. The user looks at each dot for ~2 seconds.
 * Collects gaze samples via the GazeTracker and computes the calibration transform.
 *
 * Props:
 *   gazeTracker   - GazeTracker instance
 *   getLandmarks   - function that returns current MediaPipe landmarks + dimensions
 *                    () => { landmarks, imageWidth, imageHeight } | null
 *   onComplete     - callback when calibration finishes (success: boolean)
 *   onCancel       - callback when user cancels
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Calibration grid: 3×3 with margin
const GRID_COLS = 3;
const GRID_ROWS = 3;
const MARGIN = 0.1; // 10% margin from screen edges

function getCalibrationPoints(screenW, screenH) {
  const points = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      points.push({
        x: screenW * (MARGIN + (c / (GRID_COLS - 1)) * (1 - 2 * MARGIN)),
        y: screenH * (MARGIN + (r / (GRID_ROWS - 1)) * (1 - 2 * MARGIN)),
        id: r * GRID_COLS + c,
      });
    }
  }
  return points;
}

// Calibration states
const STATE = {
  INTRO: 'intro',
  COLLECTING: 'collecting',
  TRANSITIONING: 'transitioning',
  COMPUTING: 'computing',
  DONE: 'done',
  FAILED: 'failed',
};

export default function GazeCalibration({
  gazeTracker,
  getLandmarks,
  onComplete,
  onCancel,
}) {
  const [state, setState] = useState(STATE.INTRO);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0-1 for current point
  const [points, setPoints] = useState([]);
  const [completedPoints, setCompletedPoints] = useState(new Set());
  const [validationError, setValidationError] = useState(null);

  const collectIntervalRef = useRef(null);
  const samplesCollected = useRef(0);
  const SAMPLES_PER_POINT = 45; // ~1.5 seconds at 30fps
  const TRANSITION_MS = 600;

  // Initialize calibration points
  useEffect(() => {
    setPoints(getCalibrationPoints(window.innerWidth, window.innerHeight));
    gazeTracker.resetCalibration();
  }, [gazeTracker]);

  // Collect samples for current calibration point
  const startCollecting = useCallback(
    (pointIdx) => {
      if (!points[pointIdx]) return;

      const target = points[pointIdx];
      samplesCollected.current = 0;
      setProgress(0);
      setState(STATE.COLLECTING);

      collectIntervalRef.current = setInterval(() => {
        const data = getLandmarks();
        if (!data || !data.landmarks) return;

        gazeTracker.addCalibrationSample(
          target.x,
          target.y,
          data.landmarks,
          data.imageWidth,
          data.imageHeight
        );

        samplesCollected.current++;
        setProgress(samplesCollected.current / SAMPLES_PER_POINT);

        if (samplesCollected.current >= SAMPLES_PER_POINT) {
          clearInterval(collectIntervalRef.current);
          collectIntervalRef.current = null;

          setCompletedPoints((prev) => new Set([...prev, pointIdx]));

          // Move to next point or finish
          const nextIdx = pointIdx + 1;
          if (nextIdx < points.length) {
            setState(STATE.TRANSITIONING);
            setTimeout(() => {
              setCurrentIdx(nextIdx);
              startCollecting(nextIdx);
            }, TRANSITION_MS);
          } else {
            // All points collected — compute calibration
            setState(STATE.COMPUTING);
            setTimeout(() => {
              const success = gazeTracker.computeCalibration();
              if (success) {
                // Save calibration to localStorage
                const calibData = gazeTracker.exportCalibration();
                if (calibData) {
                  try {
                    localStorage.setItem(
                      'emotilearn_gaze_calibration',
                      JSON.stringify(calibData)
                    );
                  } catch (e) {
                    // localStorage not available, skip
                  }
                }
                setState(STATE.DONE);
                setTimeout(() => onComplete?.(true), 800);
              } else {
                setState(STATE.FAILED);
                setValidationError('Not enough valid samples. Please try again.');
              }
            }, 300);
          }
        }
      }, 33); // ~30fps
    },
    [points, gazeTracker, getLandmarks, onComplete]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (collectIntervalRef.current) {
        clearInterval(collectIntervalRef.current);
      }
    };
  }, []);

  const handleStart = () => {
    setCurrentIdx(0);
    startCollecting(0);
  };

  const handleRetry = () => {
    gazeTracker.resetCalibration();
    setCompletedPoints(new Set());
    setCurrentIdx(0);
    setProgress(0);
    setValidationError(null);
    setState(STATE.INTRO);
  };

  const currentPoint = points[currentIdx];

  return (
    <div
      className="fixed inset-0 z-[9999] select-none"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Intro screen */}
      {state === STATE.INTRO && (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <div className="max-w-md text-center space-y-6">
            <div className="text-5xl mb-2">👁️</div>
            <h2 className="text-2xl font-semibold">Gaze Calibration</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              A dot will appear at 9 positions on your screen.
              Look directly at each dot and keep your gaze steady until it completes.
              Try not to move your head during calibration.
            </p>
            <p className="text-gray-400 text-xs">
              This takes about 20 seconds. Your webcam must be active.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
              >
                Start Calibration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calibration dots */}
      {(state === STATE.COLLECTING ||
        state === STATE.TRANSITIONING ||
        state === STATE.COMPUTING) && (
        <>
          {/* Progress indicator */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white text-sm">
            <span className="text-gray-400">Point </span>
            <span className="font-mono">
              {Math.min(currentIdx + 1, points.length)}
            </span>
            <span className="text-gray-400"> / {points.length}</span>
          </div>

          {/* All dots (completed ones shown as small dots) */}
          {points.map((pt, idx) => {
            const isCompleted = completedPoints.has(idx);
            const isCurrent = idx === currentIdx;
            const isFuture = idx > currentIdx;

            if (isFuture && state !== STATE.COMPUTING) return null;

            return (
              <div
                key={pt.id}
                className="absolute transition-all duration-300"
                style={{
                  left: pt.x,
                  top: pt.y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {isCurrent && state === STATE.COLLECTING ? (
                  // Active dot with progress ring
                  <div className="relative">
                    {/* Outer ring (progress) */}
                    <svg
                      width="60"
                      height="60"
                      className="absolute -top-[30px] -left-[30px]"
                    >
                      <circle
                        cx="30"
                        cy="30"
                        r="24"
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r="24"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeDasharray={`${progress * 150.8} 150.8`}
                        strokeLinecap="round"
                        transform="rotate(-90 30 30)"
                        className="transition-all duration-100"
                      />
                    </svg>
                    {/* Center dot (pulsing) */}
                    <div
                      className="w-3 h-3 rounded-full bg-white shadow-lg shadow-white/40"
                      style={{
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  </div>
                ) : isCompleted ? (
                  // Completed dot
                  <div className="w-2 h-2 rounded-full bg-green-400 opacity-60" />
                ) : isCurrent && state === STATE.TRANSITIONING ? (
                  // Transitioning dot (appearing)
                  <div className="w-3 h-3 rounded-full bg-white opacity-50 animate-ping" />
                ) : null}
              </div>
            );
          })}

          {/* Computing overlay */}
          {state === STATE.COMPUTING && (
            <div className="flex items-center justify-center h-full">
              <div className="text-white text-center space-y-3">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-300">Computing calibration...</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Success */}
      {state === STATE.DONE && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-white space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-lg font-medium">Calibration complete!</p>
          </div>
        </div>
      )}

      {/* Failed */}
      {state === STATE.FAILED && (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <div className="max-w-sm text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-lg font-medium">Calibration failed</p>
            <p className="text-sm text-gray-400">{validationError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline keyframe for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
