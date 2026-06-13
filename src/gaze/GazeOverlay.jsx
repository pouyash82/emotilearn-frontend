/**
 * GazeOverlay.jsx
 * Tobii-style gaze visualization overlay.
 *
 * Renders two layers on a full-screen canvas:
 *   1. Background heatmap: accumulated Gaussian blobs showing gaze history
 *   2. Foreground circle: follows current gaze, shrinks during fixation
 *
 * Props:
 *   gazeResult     - latest GazeResult from GazeTracker.processLandmarks()
 *   gazeTracker    - GazeTracker instance (for heatmap data access)
 *   visible        - whether the overlay is visible
 *   showHeatmap    - whether to render the heatmap layer (default true)
 *   showCircle     - whether to render the fixation circle (default true)
 *   showScanpath   - whether to show scanpath lines (default false, teacher view)
 *   opacity        - overall overlay opacity (default 0.6)
 *   circleColor    - CSS color for the fixation circle (default '#3b82f6')
 */

import React, { useRef, useEffect, useCallback } from 'react';

// Color map for heatmap (viridis-inspired: transparent → blue → green → yellow → red)
const HEATMAP_COLORS = [
  [0, 0, 0, 0],         // 0.0 - transparent
  [68, 1, 84, 40],      // 0.1 - dark purple
  [59, 82, 139, 80],    // 0.2 - blue
  [33, 145, 140, 110],  // 0.3 - teal
  [94, 201, 98, 140],   // 0.4 - green
  [253, 231, 37, 170],  // 0.6 - yellow
  [253, 180, 47, 190],  // 0.7 - orange
  [240, 80, 40, 210],   // 0.8 - red-orange
  [220, 40, 30, 230],   // 0.9 - red
  [180, 10, 10, 245],   // 1.0 - dark red
];

function getHeatmapColor(value) {
  if (value <= 0.01) return [0, 0, 0, 0];

  const idx = Math.min(value * (HEATMAP_COLORS.length - 1), HEATMAP_COLORS.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, HEATMAP_COLORS.length - 1);
  const t = idx - lo;

  return [
    HEATMAP_COLORS[lo][0] + t * (HEATMAP_COLORS[hi][0] - HEATMAP_COLORS[lo][0]),
    HEATMAP_COLORS[lo][1] + t * (HEATMAP_COLORS[hi][1] - HEATMAP_COLORS[lo][1]),
    HEATMAP_COLORS[lo][2] + t * (HEATMAP_COLORS[hi][2] - HEATMAP_COLORS[lo][2]),
    HEATMAP_COLORS[lo][3] + t * (HEATMAP_COLORS[hi][3] - HEATMAP_COLORS[lo][3]),
  ];
}

export default function GazeOverlay({
  gazeResult,
  gazeTracker,
  visible = true,
  showHeatmap = true,
  showCircle = true,
  showScanpath = false,
  opacity = 0.6,
  circleColor = '#3b82f6',
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Smoothed circle position (for extra visual smoothness on top of Kalman)
  const circlePos = useRef({ x: 0, y: 0 });
  const circleRadius = useRef(40);
  const circleOpacity = useRef(0.3);

  // Offscreen canvas for heatmap (avoids re-rendering full heatmap every frame)
  const heatmapCanvasRef = useRef(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // ─── Heatmap Layer ───
    if (showHeatmap && gazeTracker) {
      const hm = gazeTracker.getHeatmapData();
      renderHeatmap(ctx, hm, w, h, opacity);
    }

    // ─── Scanpath Layer (teacher view) ───
    if (showScanpath && gazeResult?.fixationHistory?.length > 1) {
      renderScanpath(ctx, gazeResult.fixationHistory, opacity);
    }

    // ─── Fixation Circle Layer ───
    if (showCircle && gazeResult) {
      // Lerp circle position for smooth following
      const lerpFactor = 0.35;
      circlePos.current.x += (gazeResult.x - circlePos.current.x) * lerpFactor;
      circlePos.current.y += (gazeResult.y - circlePos.current.y) * lerpFactor;

      // Circle size: shrinks during fixation
      let targetRadius, targetOpacity;
      if (gazeResult.isFixating) {
        const shrinkProgress = Math.min(1, gazeResult.fixationDuration / 2000);
        targetRadius = 40 - 28 * shrinkProgress; // 40px → 12px
        targetOpacity = 0.3 + 0.5 * shrinkProgress;
      } else {
        targetRadius = 40;
        targetOpacity = 0.3;
      }

      // Smooth the radius and opacity transitions
      circleRadius.current += (targetRadius - circleRadius.current) * 0.15;
      circleOpacity.current += (targetOpacity - circleOpacity.current) * 0.15;

      renderCircle(
        ctx,
        circlePos.current.x,
        circlePos.current.y,
        circleRadius.current,
        circleOpacity.current,
        circleColor,
        gazeResult.isFixating,
        gazeResult.fixationDuration
      );
    }

    animFrameRef.current = requestAnimationFrame(render);
  }, [
    visible,
    showHeatmap,
    showCircle,
    showScanpath,
    gazeResult,
    gazeTracker,
    opacity,
    circleColor,
  ]);

  // Canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Animation loop
  useEffect(() => {
    if (visible) {
      animFrameRef.current = requestAnimationFrame(render);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [visible, render]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998 }}
    />
  );
}

// ──────────────────────────────────────────────
//  Rendering functions
// ──────────────────────────────────────────────

function renderHeatmap(ctx, hm, canvasW, canvasH, globalOpacity) {
  if (!hm || !hm.data) return;

  const { data, width: gridW, height: gridH } = hm;
  const cellW = canvasW / gridW;
  const cellH = canvasH / gridH;

  // Use an offscreen canvas for per-cell rendering, then composite
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const value = data[gy * gridW + gx];
      if (value < 0.02) continue; // skip nearly-empty cells

      const color = getHeatmapColor(value);
      const alpha = (color[3] / 255) * globalOpacity;
      if (alpha < 0.01) continue;

      ctx.fillStyle = `rgba(${color[0] | 0}, ${color[1] | 0}, ${color[2] | 0}, ${alpha.toFixed(3)})`;

      // Draw slightly oversized cells for smooth blending
      const px = gx * cellW - cellW * 0.3;
      const py = gy * cellH - cellH * 0.3;
      const pw = cellW * 1.6;
      const ph = cellH * 1.6;

      // Use radial gradient for smooth blobs
      const cx = gx * cellW + cellW / 2;
      const cy = gy * cellH + cellH / 2;
      const radius = Math.max(cellW, cellH) * 0.9;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${color[0] | 0}, ${color[1] | 0}, ${color[2] | 0}, ${alpha.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${color[0] | 0}, ${color[1] | 0}, ${color[2] | 0}, 0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(px, py, pw, ph);
    }
  }
}

function renderCircle(ctx, x, y, radius, opacity, color, isFixating, duration) {
  // Parse hex color
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  // Outer glow
  const glowRadius = radius * 2;
  const glowGrad = ctx.createRadialGradient(x, y, radius * 0.5, x, y, glowRadius);
  glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(opacity * 0.3).toFixed(3)})`);
  glowGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Main circle outline
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Fill (more opaque during fixation)
  if (isFixating) {
    const fillAlpha = opacity * 0.25;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha.toFixed(3)})`;
    ctx.fill();

    // Inner dot at fixation center
    if (duration > 500) {
      const dotRadius = Math.max(3, radius * 0.25);
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${(opacity * 0.8).toFixed(3)})`;
      ctx.fill();
    }

    // Duration text (subtle, only after 1 second)
    if (duration > 1000) {
      const secs = (duration / 1000).toFixed(1);
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 255, 255, ${(opacity * 0.5).toFixed(3)})`;
      ctx.fillText(`${secs}s`, x, y + radius + 14);
    }
  }

  // Crosshair inside circle (subtle)
  const crossLen = radius * 0.35;
  ctx.strokeStyle = `rgba(255, 255, 255, ${(opacity * 0.3).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - crossLen, y);
  ctx.lineTo(x + crossLen, y);
  ctx.moveTo(x, y - crossLen);
  ctx.lineTo(x, y + crossLen);
  ctx.stroke();
}

function renderScanpath(ctx, fixationHistory, globalOpacity) {
  if (fixationHistory.length < 2) return;

  const alpha = 0.4 * globalOpacity;

  // Draw lines connecting fixation centers
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();

  for (let i = 0; i < fixationHistory.length; i++) {
    const f = fixationHistory[i];
    if (i === 0) {
      ctx.moveTo(f.x, f.y);
    } else {
      ctx.lineTo(f.x, f.y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw numbered circles at fixation points
  for (let i = 0; i < fixationHistory.length; i++) {
    const f = fixationHistory[i];
    const dotRadius = Math.min(12, 4 + f.duration / 500);

    // Circle
    ctx.beginPath();
    ctx.arc(f.x, f.y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(59, 130, 246, ${(alpha * 0.6).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Number
    ctx.font = `${Math.max(8, dotRadius)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.9).toFixed(3)})`;
    ctx.fillText(`${i + 1}`, f.x, f.y);
  }
}
