window.PortfolioGallery = (function () {
  const ZOOM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.35-4.35"/><path d="M11 8.5v5M8.5 11h5"/></svg>`;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildItemEl(img) {
    const el = document.createElement("a");
    el.className = "gallery-item";
    el.href = `photo/${img.id}.html`;
    el.innerHTML = `
      <img src="assets/thumbs/${img.id}.jpg" alt="${esc(img.title)}" loading="lazy" draggable="false">
      <button type="button" class="gi-zoom-hint" title="Quick zoom" aria-label="Quick zoom">${ZOOM_ICON}</button>
      <div class="gi-overlay">
        <div>
          <span class="gi-title">${esc(img.title)}</span>
          ${img.location ? `<span class="gi-loc">${esc(img.location)}</span>` : ""}
        </div>
      </div>
    `;
    return el;
  }

  function render(container, images) {
    container.innerHTML = "";
    if (!images.length) {
      container.innerHTML = '<div class="gallery-empty">No images in this category yet.</div>';
      return;
    }
    const width = container.clientWidth;
    const targetHeight = width < 640 ? 190 : 260;
    const gap = 6;
    const rows = window.justifyRows(images, width, targetHeight, gap);

    const frag = document.createDocumentFragment();
    rows.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "gallery-row";
      row.items.forEach(({ item, width }) => {
        const el = buildItemEl(item);
        el.style.width = width + "px";
        el.style.height = row.height + "px";
        const zoomBtn = el.querySelector(".gi-zoom-hint");
        zoomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.Lightbox.open(images, images.indexOf(item));
        });
        rowEl.appendChild(el);
      });
      frag.appendChild(rowEl);
    });
    container.appendChild(frag);
  }

  function renderResponsive(container, images) {
    render(container, images);
    let raf;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => render(container, images));
    });
  }

  return { render, renderResponsive };
})();
