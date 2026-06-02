// Body-language analyzer. Browser-side MediaPipe Tasks (pose + face landmarks).
// No network calls to ElevenLabs/Claude - everything runs on the user's device.
//
// Lifecycle:
//   enableCamera(videoEl)   - start camera, lazy-load MediaPipe models, begin frame loop
//   markTurnStart()         - reset accumulators (called when mic recording begins)
//   markTurnEnd()           - return aggregated metrics for the just-finished turn
//   disableCamera()         - stop stream + analysis
//
// Output schema (markTurnEnd):
//   {
//     eyeContact:    0..1 ratio of frames-with-face where gaze is forward
//     facePresence:  0..1 ratio of frames where a face was detected
//     postureScore:  0..1 (1 = level shoulders, 0 = very tilted)
//     gestureLevel:  0..1 normalized hand movement variance
//     stillnessScore: 0..1 (1 = head steady, 0 = constant fidget)
//     samples:       int    raw frame count
//     durationSec:   number wall-clock seconds the turn covered
//   }
//
// Models are pulled from the official MediaPipe CDN (~5MB total, cached by the
// browser after the first load).
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

let _pose = null, _face = null, _ready = null;
let _videoEl = null, _stream = null, _running = false, _rafId = 0;
let _turnState = null;
// Eye-contact baseline. When a user's camera sits above their monitor (the normal
// laptop setup) their natural forward gaze still trips the eyeLookDown blendshape.
// Calibrating against "look at the lens for 3 seconds" gives us a personal floor
// to score against instead of treating the corpus zero as the truth.
let _eyeBaseline = null;
export function setEyeBaseline(baseline) { _eyeBaseline = baseline || null; }
export function getEyeBaseline() { return _eyeBaseline; }

async function loadModels() {
  if (_pose && _face) return;
  if (!_ready) {
    _ready = (async () => {
      const mod = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm");
      const { FilesetResolver, PoseLandmarker, FaceLandmarker } = mod;
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      [_pose, _face] = await Promise.all([
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1,
        }),
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true,
        }),
      ]);
    })();
  }
  await _ready;
}

function freshState() {
  return {
    startTs: performance.now(),
    frames: 0, framesWithFace: 0, framesGazeForward: 0,
    shoulderTiltSum: 0, shoulderTiltCount: 0,
    wristPts: [], headPts: [],
  };
}

function variance(arr, key) {
  if (arr.length < 2) return 0;
  let sum = 0; for (const p of arr) sum += p[key];
  const m = sum / arr.length;
  let v = 0; for (const p of arr) v += (p[key] - m) ** 2;
  return v / arr.length;
}

function snapshot(s) {
  if (!s || !s.frames) return null;
  const eyeContact = s.framesWithFace ? s.framesGazeForward / s.framesWithFace : null;
  const facePresence = s.frames ? s.framesWithFace / s.frames : null;
  const meanShoulderTilt = s.shoulderTiltCount ? s.shoulderTiltSum / s.shoulderTiltCount : null;
  // shoulderTilt is the abs y-difference of normalized landmarks. Roughly 0.005 = perfect,
  // 0.08+ = very tilted. Map to 0..1 inverted.
  const postureScore = meanShoulderTilt == null ? null
    : Math.max(0, Math.min(1, 1 - (meanShoulderTilt / 0.08)));
  // Gesture: wrist position variance. ~0 (no movement) up to ~0.05 (lots).
  const wristVar = variance(s.wristPts, "x") + variance(s.wristPts, "y");
  const gestureLevel = Math.max(0, Math.min(1, wristVar / 0.03));
  // Stillness: lower head variance is better. 1 = steady, 0 = lots of head movement.
  const headVar = variance(s.headPts, "x") + variance(s.headPts, "y");
  const stillnessScore = Math.max(0, Math.min(1, 1 - (headVar / 0.012)));
  return {
    eyeContact, facePresence, postureScore, gestureLevel, stillnessScore,
    samples: s.frames,
    durationSec: (performance.now() - s.startTs) / 1000,
  };
}

function loop() {
  if (!_running || !_videoEl || _videoEl.readyState < 2) {
    if (_running) _rafId = requestAnimationFrame(loop);
    return;
  }
  const now = performance.now();
  try {
    if (_pose) {
      const r = _pose.detectForVideo(_videoEl, now);
      const lm = r.landmarks && r.landmarks[0];
      if (lm && _turnState) {
        _turnState.frames++;
        const ls = lm[11], rs = lm[12], nose = lm[0], lw = lm[15], rw = lm[16];
        if (ls && rs) { _turnState.shoulderTiltSum += Math.abs(ls.y - rs.y); _turnState.shoulderTiltCount++; }
        if (nose) _turnState.headPts.push({ x: nose.x, y: nose.y });
        if (lw) _turnState.wristPts.push({ x: lw.x, y: lw.y });
        if (rw) _turnState.wristPts.push({ x: rw.x, y: rw.y });
      } else if (_turnState) {
        _turnState.frames++;
      }
    }
    if (_face && _turnState) {
      const r = _face.detectForVideo(_videoEl, now);
      const faces = r.faceLandmarks;
      if (faces && faces.length) {
        _turnState.framesWithFace++;
        const blends = r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
        if (blends) {
          let offAxis = 0;
          for (const b of blends) {
            const n = b.categoryName;
            if (n === "eyeLookOutLeft" || n === "eyeLookOutRight" || n === "eyeLookUpLeft" ||
                n === "eyeLookUpRight" || n === "eyeLookDownLeft" || n === "eyeLookDownRight") {
              if (b.score > offAxis) offAxis = b.score;
            }
          }
          // Threshold is "looking forward" plus a tolerance band. If the user
          // calibrated, use their baseline as the floor.
          const floor = _eyeBaseline ? _eyeBaseline.forwardOffAxis : 0;
          if (offAxis < floor + 0.18) _turnState.framesGazeForward++;
        } else {
          // No blendshapes: count as forward if face was detected at all.
          _turnState.framesGazeForward++;
        }
      }
    }
  } catch {}
  _rafId = requestAnimationFrame(loop);
}

export async function enableCamera(videoEl) {
  _videoEl = videoEl;
  if (!_stream) {
    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
    } catch (e) { return false; }
  }
  _videoEl.srcObject = _stream;
  try { await _videoEl.play(); } catch {}
  await loadModels();
  _running = true;
  if (!_rafId) _rafId = requestAnimationFrame(loop);
  return true;
}

export function disableCamera() {
  _running = false;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0; }
  if (_stream) { try { _stream.getTracks().forEach(t => t.stop()); } catch {} _stream = null; }
  if (_videoEl) _videoEl.srcObject = null;
  _turnState = null;
}

export function isCameraOn() { return _running && !!_stream; }

// Run for `durationMs` while the user stares at the camera lens. Returns the mean
// off-axis blendshape value during that window. Save to localStorage + pass back
// via setEyeBaseline().
export async function sampleEyeBaseline(durationMs = 3000) {
  if (!_running || !_face || !_videoEl) return null;
  const samples = [];
  const start = performance.now();
  while (performance.now() - start < durationMs) {
    if (_videoEl.readyState >= 2) {
      try {
        const r = _face.detectForVideo(_videoEl, performance.now());
        const blends = r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
        if (blends) {
          let off = 0;
          for (const b of blends) {
            const n = b.categoryName;
            if (n === "eyeLookOutLeft" || n === "eyeLookOutRight" || n === "eyeLookUpLeft" ||
                n === "eyeLookUpRight" || n === "eyeLookDownLeft" || n === "eyeLookDownRight") {
              if (b.score > off) off = b.score;
            }
          }
          samples.push(off);
        }
      } catch {}
    }
    await new Promise(r => requestAnimationFrame(r));
  }
  if (samples.length < 5) return null;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { forwardOffAxis: mean, samples: samples.length, at: Date.now() };
}

export function markTurnStart() {
  if (!_running) return;
  _turnState = freshState();
}
export function markTurnEnd() {
  if (!_turnState) return null;
  const out = snapshot(_turnState);
  _turnState = null;
  return out;
}
