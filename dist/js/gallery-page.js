(async function () {
  const { config, images } = await window.PortfolioData.load();
  window.__portfolioConfig = config;
  document.title = `Gallery — ${config.siteName || "Portfolio"}`;
  window.PortfolioData.applyBranding(config);

  const categories = window.PortfolioData.categoriesFrom(images);
  const params = new URLSearchParams(location.search);
  let active = params.get("cat") || "all";
  if (active !== "all" && !categories.some((c) => c.key === active)) active = "all";

  const bar = document.getElementById("filter-bar");
  const grid = document.getElementById("gallery-grid");

  function pillsHtml() {
    const all = [{ key: "all", label: "All", count: images.length }, ...categories];
    return all
      .map(
        (c) =>
          `<button class="filter-pill${c.key === active ? " active" : ""}" data-cat="${c.key}">${c.label} <span style="opacity:.6">(${c.count})</span></button>`
      )
      .join("");
  }

  function renderCurrent() {
    const list = active === "all" ? images : images.filter((i) => i.category === active);
    window.PortfolioGallery.render(grid, list);
  }

  bar.innerHTML = pillsHtml();
  renderCurrent();

  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(renderCurrent);
  });

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-pill");
    if (!btn) return;
    active = btn.dataset.cat;
    const url = new URL(location.href);
    if (active === "all") url.searchParams.delete("cat");
    else url.searchParams.set("cat", active);
    history.replaceState(null, "", url);
    bar.innerHTML = pillsHtml();
    renderCurrent();
  });
})();
