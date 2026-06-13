# EmotiLearn Gaze Tracking Module

## Overview

Webcam-based gaze estimation with Tobii-style visualization (fixation circle + accumulated heatmap).
Uses MediaPipe Face Mesh iris landmarks, polynomial calibration, head pose fusion, and Kalman smoothing.

**Expected accuracy**: ~150-250px on 1920×1080 after 9-point calibration (region-level, sufficient for engagement analysis).
**Performance**: ~19ms total pipeline, 50+ FPS, runs alongside your existing emotion detection.

## File Structure

```
src/gaze/
├── index.js              # Barrel exports
├── GazeTracker.js        # Core computation engine (no React dependency)
├── KalmanFilter.js       # 2D position smoother
├── FixationDetector.js   # I-DT fixation/saccade classifier
├── GazeCalibration.jsx   # 9-point calibration overlay (React)
├── GazeOverlay.jsx       # Heatmap + fixation circle canvas (React)
├── useGazeTracking.js    # React hook connecting MediaPipe → tracker
└── GazeTrackingDemo.jsx  # Standalone demo/test page
```

## Integration Into EmotiLearn

### Step 1: Copy Files

Copy the `src/gaze/` folder into your React frontend's `src/` directory.

### Step 2: Add Demo Route (for testing)

In your router, add a temporary test route:

```jsx
import { GazeTrackingDemo } from './gaze';

// In your router config:
<Route path="/gaze-demo" element={<GazeTrackingDemo />} />
```

Visit `/gaze-demo` to test the full pipeline standalone.

### Step 3: Integrate Into Existing Pages

If you already run MediaPipe Face Mesh (e.g., in ExamPage.jsx), you DON'T need a second
Face Mesh instance. Instead, pipe your existing landmarks into the gaze tracker:

```jsx
import { useRef, useState } from 'react';
import GazeTracker from './gaze/GazeTracker';
import GazeOverlay from './gaze/GazeOverlay';
import GazeCalibration from './gaze/GazeCalibration';

function YourExistingPage() {
  const gazeTrackerRef = useRef(new GazeTracker(window.innerWidth, window.innerHeight));
  const [gazeResult, setGazeResult] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const latestLandmarksRef = useRef(null);

  // In your EXISTING MediaPipe onResults callback, add one line:
  const onFaceMeshResults = (results) => {
    // ... your existing emotion detection code ...

    // ADD THIS: feed landmarks to gaze tracker
    if (results.multiFaceLandmarks?.[0]) {
      latestLandmarksRef.current = results.multiFaceLandmarks[0];
      const gaze = gazeTrackerRef.current.processLandmarks(
        results.multiFaceLandmarks[0],
        videoWidth,
        videoHeight
      );
      if (gaze) setGazeResult(gaze);

      // ADD THIS: include attention in your engagement score
      if (gaze?.attention) {
        const attentionScore = gaze.attention.score;
        // Integrate into your existing engagement formula:
        // engagementScore = 0.35 * faceEmotion + 0.20 * voiceEmotion
        //                 + 0.10 * textSentiment + 0.35 * attentionScore
      }
    }
  };

  return (
    <div>
      {/* Your existing page content */}

      {/* ADD: Gaze overlay */}
      <GazeOverlay
        gazeResult={gazeResult}
        gazeTracker={gazeTrackerRef.current}
        visible={!isCalibrating}
        showHeatmap={true}
        showCircle={true}
      />

      {/* ADD: Calibration overlay */}
      {isCalibrating && (
        <GazeCalibration
          gazeTracker={gazeTrackerRef.current}
          getLandmarks={() => ({
            landmarks: latestLandmarksRef.current,
            imageWidth: videoWidth,
            imageHeight: videoHeight,
          })}
          onComplete={(success) => setIsCalibrating(false)}
          onCancel={() => setIsCalibrating(false)}
        />
      )}

      {/* ADD: Calibration button somewhere in your UI */}
      <button onClick={() => setIsCalibrating(true)}>
        Calibrate Gaze
      </button>
    </div>
  );
}
```

### Step 4: CRITICAL — Enable Iris Landmarks

Your MediaPipe Face Mesh MUST have `refineLandmarks: true` (or `refine_landmarks=True` in Python).
Without this, landmarks 468-477 (iris) won't exist and the tracker will return null.

```javascript
// JavaScript (face_mesh legacy API):
faceMesh.setOptions({ refineLandmarks: true, ... });

// JavaScript (tasks-vision new API):
const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false,
  runningMode: "VIDEO",
  numFaces: 1,
  // CRITICAL:
  outputFaceLandmarks: true,
});
// Note: tasks-vision always outputs iris landmarks when face landmarks are enabled
```

```python
# Python (for Hetzner backend):
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,  # CRITICAL
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)
```

### Step 5: Backend Integration (FastAPI)

Add attention data to your existing frame processing endpoint:

```python
# In your FastAPI models:
class FrameData(BaseModel):
    # ... existing fields ...
    attention_score: Optional[float] = None
    gaze_x: Optional[float] = None
    gaze_y: Optional[float] = None
    is_fixating: Optional[bool] = None
    fixation_duration: Optional[float] = None
    head_yaw: Optional[float] = None
    head_pitch: Optional[float] = None

# In your session/engagement endpoint:
@app.post("/api/session/{session_id}/frame")
async def process_frame(session_id: int, data: FrameData):
    # ... existing emotion processing ...

    # Add attention to engagement score
    if data.attention_score is not None:
        engagement = (
            0.35 * emotion_score +
            0.20 * voice_score +
            0.10 * text_score +
            0.35 * data.attention_score
        )
    else:
        # Fallback to old formula when gaze not available
        engagement = (
            0.50 * emotion_score +
            0.30 * voice_score +
            0.20 * text_score
        )
```

### Step 6: Hetzner CCTV Mode

For CCTV, you can only use head pose (not iris gaze). The GazeTracker's
`_estimateHeadPose()` method works at any distance, but iris gaze ratios
are meaningless when the camera is meters away.

```python
# Python backend (Hetzner CCTV processing):
# In your existing per-face processing loop:

def compute_head_attention(landmarks, img_w, img_h):
    """Classify attention based on head pose from CCTV."""
    nose = landmarks[1]
    left_eye = landmarks[263]
    right_eye = landmarks[33]

    # Compute yaw from nose-to-eye ratio
    d_left = abs(nose.x * img_w - left_eye.x * img_w)
    d_right = abs(nose.x * img_w - right_eye.x * img_w)
    eye_span = abs(left_eye.x * img_w - right_eye.x * img_w) or 1
    yaw_ratio = (d_right - d_left) / eye_span
    yaw = yaw_ratio * 45  # approximate degrees

    # Classify
    if abs(yaw) < 15:
        return "attentive", 0.8  # facing forward
    elif abs(yaw) < 30:
        return "uncertain", 0.5  # slightly turned
    else:
        return "distracted", 0.2  # looking away

    # You can draw a direction cone on the frame:
    # cv2.arrowedLine(frame, face_center, endpoint, color, thickness)
```

## Configuration

### Tuning Parameters

| Parameter | Default | Effect |
|---|---|---|
| `kalmanProcess` | 0.04 | Lower = smoother circle movement |
| `kalmanMeasurement` | 120 | Lower = more responsive, more jittery |
| `fixationDispersion` | 100 | Max pixel spread for fixation cluster |
| `fixationMinDuration` | 150 | Min ms to count as fixation |
| `heatmapDecay` | 0.997 | Higher = slower heatmap fade (0.999 = very persistent) |
| `eyeWeight` | 0.77 | Iris vs head pose fusion weight |

### Calibration Tips

- 9 points (3×3) is the default. For higher accuracy, modify GRID_COLS/GRID_ROWS to 4×4 in GazeCalibration.jsx.
- Calibration is screen-size-specific. It's saved to localStorage and auto-restored if screen size matches.
- Tell users to keep their head relatively still during calibration but in a natural position.
- Recalibrate if the user changes seating position significantly.

## Performance

| Component | Time (CPU) | Notes |
|---|---|---|
| MediaPipe Face Mesh | ~15ms | Already running in your app |
| Gaze ratio computation | ~0.5ms | Pure math |
| Calibration transform | ~0.1ms | 6-coeff polynomial |
| Kalman filter | ~0.1ms | Matrix multiply |
| Fixation detection | ~0.2ms | Window scan |
| Heatmap update | ~0.3ms | Gaussian splat |
| Canvas render | ~2ms | Two layers |
| **Total additional** | **~3ms** | On top of existing MediaPipe |

## Dependencies

- React 18+ (you have this)
- MediaPipe Face Mesh with iris landmarks (you have this)
- No other external dependencies (Kalman filter + polynomial regression implemented from scratch)
