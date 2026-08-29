// Generates dist/photo/<id>.html for every published photo.
import { loadConfig, loadImages } from "./lib/store.mjs";
import { buildAllPages } from "./lib/render-page.mjs";

const config = loadConfig();
const images = loadImages();

const { built, pruned } = buildAllPages(images, config);
for (const f of pruned) console.log(`Pruned orphaned photo/${f}`);
console.log(`Built ${built} photo story pages in dist/photo/`);
