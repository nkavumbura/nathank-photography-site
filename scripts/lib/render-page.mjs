// Renders dist/photo/<id>.html - the per-photo story page (title, narrative,
// EXIF table, Etsy CTA, inline zoom, prev/next). Shared by the batch page
// builder and the admin server, which re-renders all pages after any edit
// (cheap - pure string templating, no image processing).
import fs from "fs";
import path from "path";
import { PHOTO_DIR } from "./paths.mjs";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function metaRows(img) {
  const cam = img.camera || {};
  const rows = [];
  if (img.location) rows.push(["Location", esc(img.location)]);
  const date = formatDate(cam.date);
  if (date) rows.push(["Date captured", esc(date)]);
  if (cam.model) rows.push(["Camera", esc(cam.model)]);
  if (cam.lens) rows.push(["Lens", esc(cam.lens)]);
  if (cam.focalLength) rows.push(["Focal length", esc(cam.focalLength)]);
  if (cam.aperture) rows.push(["Aperture", esc(cam.aperture)]);
  if (cam.shutter) rows.push(["Shutter speed", esc(cam.shutter)]);
  if (cam.iso) rows.push(["ISO", esc(String(cam.iso))]);
  if (cam.gps) {
    const { lat, lon } = cam.gps;
    const mapUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    rows.push(["Coordinates", `<a href="${mapUrl}" target="_blank" rel="noopener" style="text-decoration:underline;">${lat.toFixed(4)}, ${lon.toFixed(4)} ↗</a>`]);
  }
  return rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("\n");
}

function storyBlock(img) {
  if (img.story && img.story.trim()) {
    const paras = img.story
      .trim()
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("\n");
    return `<div class="pd-story-text">${paras}</div>`;
  }
  return `<div class="pd-story-text pd-story-empty">The story behind this shot hasn't been added yet.</div>`;
}

function navLink(img, dir) {
  if (!img) return "<span></span>";
  const label = dir === "prev" ? "← Previous" : "Next →";
  return `
    <a href="${img.id}.html">
      ${dir === "prev" ? `<img class="pd-nav-thumb" src="../assets/thumbs/${img.id}.jpg" alt="">` : ""}
      <span>${label}<br><b style="color:var(--fg);">${esc(img.title)}</b></span>
      ${dir === "next" ? `<img class="pd-nav-thumb" src="../assets/thumbs/${img.id}.jpg" alt="">` : ""}
    </a>`;
}

export function renderPhotoPageHtml(img, prev, next, config) {
  const shopUrl = img.etsyUrl || config.etsyShopUrl || "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(img.title)} — ${esc(config.siteName || "Portfolio")}</title>
<meta name="description" content="${esc(img.location || img.title)} — panoramic photograph${img.camera?.model ? " shot on " + esc(img.camera.model) : ""}.">
<meta property="og:title" content="${esc(img.title)}">
<meta property="og:description" content="${esc(img.location || config.tagline || "")}">
<meta property="og:type" content="article">
<link rel="icon" type="image/png" href="../favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../css/style.css">
</head>
<body data-page="photo">

<header class="site-header">
  <div class="container">
    <a class="brand" href="../index.html">
      ${config.branding?.hasLogo ? `<img class="brand-logo" src="../assets/logo.png" alt="">` : ""}
      <span>${esc(config.siteName || "Portfolio")}</span>
    </a>
    <nav class="main-nav">
      <a href="../index.html">Home</a>
      <a href="../gallery.html">Gallery</a>
      <a href="../about.html">About</a>
    </nav>
  </div>
</header>

<div class="pd-stage" id="pd-stage">
  <canvas id="pd-canvas"></canvas>
  <div class="lb-hint">Ctrl/⌘ + scroll or pinch to zoom · drag to pan</div>
  <button class="icon-btn pd-fullscreen-btn" id="pd-fullscreen" title="Open full-screen" aria-label="Open full-screen">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
  </button>
  <noscript><img src="../assets/display/${img.id}.jpg" alt="${esc(img.title)}" style="width:100%;height:100%;object-fit:contain;"></noscript>
</div>

<div class="container pd-body">
  <div class="pd-head">
    <span class="pd-category">${esc(img.categoryLabel)}</span>
    <h1>${esc(img.title)}</h1>
    ${img.location ? `<p class="pd-loc">${esc(img.location)}</p>` : ""}
  </div>

  <div class="pd-grid">
    <div class="pd-story-col">
      <div class="pd-byline">
        <div class="pd-avatar">${esc(initials(config.photographerName))}</div>
        <div>
          <div class="pd-byline-name">${esc(config.photographerName || "")}</div>
          <div class="pd-byline-role">Photographer</div>
        </div>
      </div>
      ${storyBlock(img)}
    </div>
    <aside class="pd-meta">
      <table>${metaRows(img)}</table>
      ${
        shopUrl
          ? `<a class="btn primary" href="${esc(shopUrl)}" target="_blank" rel="noopener">View print / digital download</a>`
          : `<a class="btn primary disabled" aria-disabled="true">Shop coming soon</a>`
      }
    </aside>
  </div>

  <nav class="pd-nav">
    <div class="pd-nav-prev">${prev ? navLink(prev, "prev") : "<span></span>"}</div>
    <div class="pd-nav-center"><a href="../gallery.html">All panoramas</a></div>
    <div class="pd-nav-next">${next ? navLink(next, "next") : "<span></span>"}</div>
  </nav>
</div>

<footer class="site-footer">
  <div class="container" style="display:flex; justify-content:space-between; width:100%; flex-wrap:wrap; gap:12px;">
    <span>© <span id="footer-year"></span> ${esc(config.photographerName || "Your Name")}. All rights reserved.</span>
    <span>${shopUrl ? "" : "Prints &amp; digital downloads coming soon."}</span>
  </div>
</footer>

<script src="../js/protections.js"></script>
<script src="../js/zoomcanvas.js"></script>
<script src="../js/lightbox.js"></script>
<script>
  document.getElementById("footer-year").textContent = new Date().getFullYear();
  window.__portfolioConfig = ${JSON.stringify(config)};
  const viewer = window.createZoomViewer({
    stage: document.getElementById("pd-stage"),
    canvas: document.getElementById("pd-canvas"),
    requireModifierForWheel: true,
  });
  viewer.loadImage("../assets/display/${img.id}.jpg");
  document.getElementById("pd-fullscreen").addEventListener("click", () => {
    window.Lightbox.open([${JSON.stringify(img)}], 0);
  });
</script>
</body>
</html>
`;
}

export function buildAllPages(images, config) {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  let built = 0;
  for (let i = 0; i < images.length; i++) {
    const html = renderPhotoPageHtml(images[i], images[i - 1], images[i + 1], config);
    fs.writeFileSync(path.join(PHOTO_DIR, `${images[i].id}.html`), html);
    built++;
  }
  const currentIds = new Set(images.map((i) => i.id));
  const pruned = [];
  for (const f of fs.readdirSync(PHOTO_DIR)) {
    const m = f.match(/^(img-[\w-]+)\.html$/);
    if (m && !currentIds.has(m[1])) {
      fs.unlinkSync(path.join(PHOTO_DIR, f));
      pruned.push(f);
    }
  }
  return { built, pruned };
}
