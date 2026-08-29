(async function () {
  const { config, images } = await window.PortfolioData.load();
  window.__portfolioConfig = config;

  document.title = config.siteName || "Portfolio";
  window.PortfolioData.applyBranding(config);
  if (config.tagline) document.getElementById("hero-sub").textContent = config.tagline + ". Explore the full gallery and zoom in to see the detail the panoramic format captures.";

  // hero: an explicit pick from the admin editor, falling back to the
  // widest/highest-resolution panorama if none has been chosen yet
  const panoramas = images.filter((i) => i.isPanorama);
  const pool = panoramas.length ? panoramas : images;
  const homeCfg = config.home || {};
  const hero =
    images.find((i) => i.id === homeCfg.heroImageId) ||
    pool.reduce((best, cur) => (cur.aspect * cur.width > best.aspect * best.width ? cur : best), pool[0]);
  if (hero) {
    const heroImg = document.getElementById("hero-img");
    heroImg.src = `assets/display/${hero.id}.jpg`;
    heroImg.alt = hero.title;
    heroImg.style.objectPosition = `${homeCfg.heroFocalX ?? 50}% 50%`;
    document.getElementById("hero-title").textContent = homeCfg.heroTitle || hero.title;
  }

  // category tiles
  const categories = window.PortfolioData.categoriesFrom(images);
  const grid = document.getElementById("category-grid");
  grid.innerHTML = categories
    .map((cat) => {
      const sample = images.find((i) => i.category === cat.key);
      return `
        <a class="category-card" href="gallery.html?cat=${encodeURIComponent(cat.key)}">
          <img src="assets/thumbs/${sample.id}.jpg" alt="${cat.label}" loading="lazy" draggable="false">
          <span class="cc-label">${cat.label}</span>
          <span class="cc-count">${cat.count}</span>
        </a>`;
    })
    .join("");

  // featured panoramas strip
  const featured = panoramas
    .slice()
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, 12);
  window.PortfolioGallery.renderResponsive(document.getElementById("featured-grid"), featured);
})();
