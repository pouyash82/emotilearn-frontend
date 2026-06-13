/**
 * useGazeTracking.js
 * React hook that connects a webcam video stream to MediaPipe Face Mesh
 * and the GazeTracker engine.
 *
 * Usage:
 *   const {
 *     gazeResult,
 *     gazeTracker,
 *     isTracking,
 *     isCalibrated,
 *     startTracking,
 *     stopTracking,
 *     getLandmarks,
 *     startCalibration,
 *     cancelCalibration,
 *     isCalibrating,
 *   } = useGazeTracking(videoRef);
 *
 * Requirements:
 *   - @mediapipe/face_mesh or the new @mediapipe/tasks-vision
 *   - A <video> element ref with webcam stream
 *
 * NOTE: This hook assumes MediaPipe Face Mesh is already loaded and available.
 *       Adjust the import/initialization based on your MediaPipe version.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import GazeTracker from './GazeTracker.js';

/**
 * @param {React.RefObject<HTMLVideoElement>} videoRef - ref to the webcam video element
 * @param {Object} [opts]
 * @param {Object} [opts.faceMesh]         - existing FaceMesh instance (if you already have one running)
 * @param {boolean} [opts.autoStart]       - start tracking automatically (default false)
 * @param {boolean} [opts.tryRestoreCalib] - try to restore calibration from localStorage (default true)
 */
export default function useGazeTracking(videoRef, opts = {}) {
  const {
    faceMesh: externalFaceMesh = null,
    autoStart = false,
    tryRestoreCalib = true,
  } = opts;

  const [isTracking, setIsTracking] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [gazeResult, setGazeResult] = useState(null);

  const gazeTrackerRef = useRef(null);
  const faceMeshRef = useRef(externalFaceMesh);
  const animFrameRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const trackingRef = useRef(false);

  // Initialize GazeTracker
  useEffect(() => {
    gazeTrackerRef.current = new GazeTracker(
      window.innerWidth,
      window.innerHeight
    );

    // Try to restore saved calibration
    if (tryRestoreCalib) {
      try {
        const saved = localStorage.getItem('emotilearn_gaze_calibration');
        if (saved) {
          const data = JSON.parse(saved);
          // Only restore if screen size matches (calibration is screen-specific)
          if (
            data.screenWidth === window.innerWidth &&
            data.screenHeight === window.innerHeight
          ) {
            const success = gazeTrackerRef.current.importCalibration(data);
            if (success) {
              setIsCalibrated(true);
              console.log('GazeTracking: restored saved calibration');
            }
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    // Handle window resize
    const handleResize = () => {
      if (gazeTrackerRef.current) {
        gazeTrackerRef.current.screenWidth = window.innerWidth;
        gazeTrackerRef.current.screenHeight = window.innerHeight;
        // Invalidate calibration on resize (screen coords changed)
        if (gazeTrackerRef.current.isCalibrated) {
          console.warn('GazeTracking: window resized, calibration may be inaccurate');
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tryRestoreCalib]);

  // Processing loop
  const processFrame = useCallback(() => {
    if (!trackingRef.current) return;

    const video = videoRef.current;
    const tracker = gazeTrackerRef.current;

    if (
      video &&
      tracker &&
      latestLandmarksRef.current &&
      video.videoWidth > 0
    ) {
      const result = tracker.processLandmarks(
        latestLandmarksRef.current,
        video.videoWidth,
        video.videoHeight
      );

      if (result) {
        setGazeResult(result);
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [videoRef]);

  /**
   * Initialize MediaPipe Face Mesh (if not provided externally).
   * This is the function users need to adapt to their MediaPipe setup.
   */
  const initFaceMesh = useCallback(async () => {
    if (faceMeshRef.current) return faceMeshRef.current;

    // If using @mediapipe/face_mesh (legacy API):
    if (window.FaceMesh) {
      const fm = new window.FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // CRITICAL: enables iris landmarks
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      fm.onResults((results) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          latestLandmarksRef.current = results.multiFaceLandmarks[0];
        } else {
          latestLandmarksRef.current = null;
        }
      });

      faceMeshRef.current = fm;
      return fm;
    }

    // If using @mediapipe/tasks-vision (new API):
    if (window.FaceLandmarker) {
      // User should set this up themselves — too many config variations
      console.warn(
        'useGazeTracking: Please pass a FaceMesh or FaceLandmarker instance via opts.faceMesh'
      );
      return null;
    }

    console.error(
      'useGazeTracking: No MediaPipe Face Mesh available. ' +
        'Load @mediapipe/face_mesh or pass an instance via opts.faceMesh'
    );
    return null;
  }, []);

  /**
   * Start the gaze tracking loop.
   */
  const startTracking = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      console.error('useGazeTracking: no video element');
      return;
    }

    // Ensure webcam is active
    if (!video.srcObject) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });
        video.srcObject = stream;
        await video.play();
      } catch (e) {
        console.error('useGazeTracking: failed to access webcam', e);
        return;
      }
    }

    // Initialize Face Mesh if needed
    const fm = await initFaceMesh();

    if (fm && fm.send) {
      // Legacy API: need to send frames manually
      const sendFrame = async () => {
        if (!trackingRef.current) return;
        if (video.readyState >= 2) {
          await fm.send({ image: video });
        }
        setTimeout(sendFrame, 33); // ~30fps
      };

      trackingRef.current = true;
      setIsTracking(true);
      sendFrame();
      processFrame();
    } else if (externalFaceMesh) {
      // External Face Mesh — caller handles sending frames and updating landmarks
      trackingRef.current = true;
      setIsTracking(true);
      processFrame();
    } else {
      console.error('useGazeTracking: no usable Face Mesh instance');
    }
  }, [videoRef, initFaceMesh, processFrame, externalFaceMesh]);

  /**
   * Stop tracking.
   */
  const stopTracking = useCallback(() => {
    trackingRef.current = false;
    setIsTracking(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  /**
   * Provide latest landmarks (used by GazeCalibration component).
   */
  const getLandmarks = useCallback(() => {
    const video = videoRef.current;
    if (!latestLandmarksRef.current || !video) return null;
    return {
      landmarks: latestLandmarksRef.current,
      imageWidth: video.videoWidth,
      imageHeight: video.videoHeight,
    };
  }, [videoRef]);

  /**
   * Manually update landmarks (for integration with existing MediaPipe pipeline).
   * Call this from your existing onResults callback.
   */
  const updateLandmarks = useCallback((landmarks) => {
    latestLandmarksRef.current = landmarks;
  }, []);

  /**
   * Start calibration flow.
   */
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
  }, []);

  /**
   * Cancel calibration.
   */
  const cancelCalibration = useCallback(() => {
    setIsCalibrating(false);
    gazeTrackerRef.current?.resetCalibration();
  }, []);

  /**
   * Called when calibration completes.
   */
  const onCalibrationComplete = useCallback((success) => {
    setIsCalibrating(false);
    setIsCalibrated(success);
  }, []);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [autoStart, startTracking, stopTracking]);

  return {
    // State
    gazeResult,
    gazeTracker: gazeTrackerRef.current,
    isTracking,
    isCalibrated,
    isCalibrating,

    // Actions
    startTracking,
    stopTracking,
    startCalibration,
    cancelCalibration,
    onCalibrationComplete,

    // Integration helpers
    getLandmarks,
    updateLandmarks,
  };
}
