// Quick-browse full-screen viewer for the gallery grid. Uses the shared
// canvas pan/zoom engine (js/zoomcanvas.js). For the full narrative and
// EXIF table, each photo also has a dedicated story page (photo/<id>.html).
window.Lightbox = (function () {
  const state = { list: [], index: 0, viewer: null };
  let root, stage, canvas, titleEl, locEl, camEl, etsyBtn, storyLink, hint;

  function build() {
    root = document.createElement("div");
    root.className = "lightbox";
    root.innerHTML = `
      <div class="lightbox-top">
        <div class="lb-title-group">
          <h3 class="lb-title"></h3>
          <div class="lb-loc"></div>
        </div>
        <div class="lb-controls">
          <button class="icon-btn lb-zoom-out" title="Zoom out" aria-label="Zoom out">−</button>
          <button class="icon-btn lb-zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
          <button class="icon-btn lb-close" title="Close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>
      <div class="lb-stage">
        <button class="lb-nav-btn prev" aria-label="Previous">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <canvas></canvas>
        <button class="lb-nav-btn next" aria-label="Next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        <div class="lb-hint">Scroll or pinch to zoom · drag to pan</div>
      </div>
      <div class="lightbox-bottom">
        <div class="container">
          <div class="lb-meta-row">
            <div class="lb-camera"></div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <a class="btn lb-story">Read the full story</a>
              <a class="btn primary lb-etsy" target="_blank" rel="noopener">Shop coming soon</a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    stage = root.querySelector(".lb-stage");
    canvas = root.querySelector("canvas");
    titleEl = root.querySelector(".lb-title");
    locEl = root.querySelector(".lb-loc");
    camEl = root.querySelector(".lb-camera");
    etsyBtn = root.querySelector(".lb-etsy");
    storyLink = root.querySelector(".lb-story");
    hint = root.querySelector(".lb-hint");

    state.viewer = window.createZoomViewer({ stage, canvas });

    root.querySelector(".lb-close").addEventListener("click", close);
    root.querySelector(".lb-zoom-in").addEventListener("click", () => state.viewer.zoomBy(1.4));
    root.querySelector(".lb-zoom-out").addEventListener("click", () => state.viewer.zoomBy(1 / 1.4));
    root.querySelector(".prev").addEventListener("click", () => go(-1));
    root.querySelector(".next").addEventListener("click", () => go(1));

    root.addEventListener("click", (e) => {
      if (e.target === root) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!root.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderMeta(item, config) {
    titleEl.textContent = item.title;
    locEl.textContent = item.location || "";
    locEl.style.display = item.location ? "" : "none";

    const cam = item.camera || {};
    const bits = [];
    if (cam.model) bits.push(`<span><b>${esc(cam.model)}</b></span>`);
    if (cam.lens) bits.push(`<span>${esc(cam.lens)}</span>`);
    if (cam.focalLength) bits.push(`<span>${esc(cam.focalLength)}</span>`);
    if (cam.aperture) bits.push(`<span>${esc(cam.aperture)}</span>`);
    if (cam.shutter) bits.push(`<span>${esc(cam.shutter)}</span>`);
    if (cam.iso) bits.push(`<span>ISO ${esc(String(cam.iso))}</span>`);
    camEl.innerHTML = bits.join("");

    storyLink.href = `photo/${item.id}.html`;

    const shopUrl = item.etsyUrl || (config && config.etsyShopUrl) || "";
    if (shopUrl) {
      etsyBtn.href = shopUrl;
      etsyBtn.classList.remove("disabled");
      etsyBtn.textContent = "View print / digital download";
    } else {
      etsyBtn.href = "#";
      etsyBtn.classList.add("disabled");
      etsyBtn.textContent = "Shop coming soon";
    }
  }

  async function show(index) {
    state.index = (index + state.list.length) % state.list.length;
    const item = state.list[state.index];
    root.querySelector(".lb-nav-btn.prev").style.display = state.list.length > 1 ? "" : "none";
    root.querySelector(".lb-nav-btn.next").style.display = state.list.length > 1 ? "" : "none";
    hint.style.opacity = "1";
    setTimeout(() => (hint.style.opacity = "0"), 2600);

    try {
      await state.viewer.loadImage(`assets/display/${item.id}.jpg`);
    } catch {
      return;
    }
    renderMeta(item, window.__portfolioConfig);
    [1, -1].forEach((d) => {
      const it = state.list[(state.index + d + state.list.length) % state.list.length];
      if (it) new Image().src = `assets/display/${it.id}.jpg`;
    });
  }

  function go(delta) {
    show(state.index + delta);
  }

  function open(list, index) {
    if (!root) build();
    state.list = list;
    root.classList.add("open");
    document.body.style.overflow = "hidden";
    show(index);
  }

  function close() {
    root.classList.remove("open");
    document.body.style.overflow = "";
  }

  return { open };
})();
