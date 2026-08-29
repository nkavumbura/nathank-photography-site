// Loads config + image manifest once and shares them across pages.
window.PortfolioData = (function () {
  let cache = null;

  async function load() {
    if (cache) return cache;
    const [config, images] = await Promise.all([
      fetch("data/config.json").then((r) => r.json()),
      fetch("data/images.json").then((r) => r.json()),
    ]);
    cache = { config, images };
    return cache;
  }

  function categoriesFrom(images) {
    const map = new Map();
    for (const img of images) {
      if (!map.has(img.category)) map.set(img.category, { key: img.category, label: img.categoryLabel, count: 0 });
      map.get(img.category).count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  // Applies the site-wide chrome every page shares: header logo/wordmark,
  // footer name/year. `assetPrefix` lets pages nested one level deep (e.g.
  // photo/<id>.html) pass "../" so the logo path still resolves.
  function applyBranding(config, assetPrefix = "") {
    document.querySelectorAll(".footer-name").forEach((el) => (el.textContent = config.photographerName || "Your Name"));
    const footerYear = document.getElementById("footer-year");
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    const brandText = document.getElementById("brand-text");
    if (brandText) brandText.textContent = config.siteName || "Portfolio";

    const logoImg = document.getElementById("brand-logo-img");
    if (logoImg && config.branding && config.branding.hasLogo) {
      logoImg.src = `${assetPrefix}assets/logo.png`;
      logoImg.style.display = "";
    }
  }

  return { load, categoriesFrom, applyBranding };
})();
