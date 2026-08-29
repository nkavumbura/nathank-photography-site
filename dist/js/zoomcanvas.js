// Shared canvas pan/zoom engine. Draws to <canvas> (not <img>) so there is
// no plain file to drag or right-click-save. Used by both the lightbox
// modal and the inline viewer on each photo's story page.
window.createZoomViewer = function createZoomViewer({ stage, canvas, requireModifierForWheel = false }) {
  const ctx = canvas.getContext("2d");
  const state = {
    img: null,
    scale: 1,
    fitScale: 1,
    minScale: 1,
    maxScale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pointers: new Map(),
    pinchStartDist: 0,
    pinchStartScale: 1,
  };

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clampOffset() {
    const w = state.img.width * state.scale;
    const h = state.img.height * state.scale;
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    const margin = 40;
    if (w <= cw) state.offsetX = (cw - w) / 2;
    else state.offsetX = Math.min(margin, Math.max(cw - w - margin, state.offsetX));
    if (h <= ch) state.offsetY = (ch - h) / 2;
    else state.offsetY = Math.min(margin, Math.max(ch - h - margin, state.offsetY));
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (!state.img) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      state.img,
      state.offsetX, state.offsetY,
      state.img.width * state.scale, state.img.height * state.scale
    );
  }

  function setScale(newScale, cx, cy) {
    newScale = Math.min(state.maxScale, Math.max(state.minScale, newScale));
    const ratio = newScale / state.scale;
    state.offsetX = cx - (cx - state.offsetX) * ratio;
    state.offsetY = cy - (cy - state.offsetY) * ratio;
    state.scale = newScale;
    clampOffset();
    draw();
  }

  function zoomAt(cx, cy, factor) {
    setScale(state.scale * factor, cx, cy);
  }

  function zoomBy(factor) {
    zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, factor);
  }

  function fitToStage(keepZoom) {
    if (!state.img) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";

    const fit = Math.min(cw / state.img.width, ch / state.img.height);
    state.fitScale = fit;
    state.minScale = fit;
    // Cap zoom at native resolution (1 image px = 1 CSS px - the canvas
    // backing store is already scaled by devicePixelRatio, so this is the
    // sharpest useful zoom level) with a little headroom for small source
    // images that are already displayed above their native size.
    state.maxScale = Math.max(fit * 1.5, 1);
    if (!keepZoom) state.scale = fit;
    else state.scale = Math.max(state.minScale, Math.min(state.maxScale, state.scale));
    state.offsetX = (cw - state.img.width * state.scale) / 2;
    state.offsetY = (ch - state.img.height * state.scale) / 2;
    draw();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        state.img = image;
        fitToStage(false);
        resolve(image);
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  canvas.addEventListener("wheel", (e) => {
    // A trackpad pinch fires wheel events with ctrlKey set, so this still
    // treats real pinch gestures as zoom even when a modifier is required.
    if (requireModifierForWheel && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.pow(1.0015, -e.deltaY));
  }, { passive: false });

  canvas.addEventListener("dblclick", (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (state.scale > state.fitScale * 1.05) setScale(state.fitScale, cx, cy);
    else zoomAt(cx, cy, (state.maxScale / state.scale) * 0.6);
  });

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pointers.size === 1) {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    } else if (state.pointers.size === 2) {
      state.dragging = false;
      const pts = Array.from(state.pointers.values());
      state.pinchStartDist = dist(pts[0], pts[1]);
      state.pinchStartScale = state.scale;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!state.pointers.has(e.pointerId)) return;
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointers.size === 2) {
      const pts = Array.from(state.pointers.values());
      const d = dist(pts[0], pts[1]);
      const factor = (d / state.pinchStartDist) * state.pinchStartScale / state.scale;
      const rect = canvas.getBoundingClientRect();
      zoomAt((pts[0].x + pts[1].x) / 2 - rect.left, (pts[0].y + pts[1].y) / 2 - rect.top, factor);
    } else if (state.dragging) {
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.offsetX += dx;
      state.offsetY += dy;
      clampOffset();
      draw();
    }
  });

  function endPointer(e) {
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) state.pinchStartDist = 0;
    if (state.pointers.size === 0) state.dragging = false;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", endPointer);

  window.addEventListener("resize", () => fitToStage(true));

  return {
    loadImage,
    zoomBy,
    reset: () => fitToStage(false),
  };
};
