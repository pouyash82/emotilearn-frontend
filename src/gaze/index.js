/**
 * EmotiLearn Gaze Tracking Module
 *
 * Webcam-based gaze estimation with Tobii-style visualization.
 * Uses MediaPipe Face Mesh iris landmarks + calibration + head pose fusion.
 *
 * Quick start:
 *   import { useGazeTracking, GazeOverlay, GazeCalibration } from './gaze';
 *
 * For standalone testing:
 *   import { GazeTrackingDemo } from './gaze';
 */

export { default as GazeTracker } from './GazeTracker.js';
export { default as KalmanFilter } from './KalmanFilter.js';
export { default as FixationDetector } from './FixationDetector.js';
export { default as GazeCalibration } from './GazeCalibration.jsx';
export { default as GazeOverlay } from './GazeOverlay.jsx';
export { default as useGazeTracking } from './useGazeTracking.js';
export { default as GazeTrackingDemo } from './GazeTrackingDemo.jsx';
