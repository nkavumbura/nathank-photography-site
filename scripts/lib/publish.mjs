// One call that brings dist/ back in sync with the current data files:
// copies images.json/config.json into dist/data, regenerates every photo
// page, and prunes assets/pages for anything no longer published. Cheap
// enough (no image processing) to call after every text/order/category
// edit so the admin tool feels live.
import fs from "fs";
import path from "path";
import { DIST_DIR, IMAGES_PATH, CONFIG_PATH } from "./paths.mjs";
import { buildAllPages } from "./render-page.mjs";
import { pruneOrphanedAssets } from "./process-image.mjs";
import { loadArchived } from "./store.mjs";

export function publish(images, config) {
  const distDataDir = path.join(DIST_DIR, "data");
  fs.mkdirSync(distDataDir, { recursive: true });
  fs.copyFileSync(IMAGES_PATH, path.join(distDataDir, "images.json"));
  fs.copyFileSync(CONFIG_PATH, path.join(distDataDir, "config.json"));

  const { built, pruned: prunedPages } = buildAllPages(images, config);
  const publishedIds = new Set(images.map((i) => i.id));
  const archivedIds = new Set(loadArchived().map((i) => i.id));
  const prunedAssets = pruneOrphanedAssets(publishedIds, new Set([...publishedIds, ...archivedIds]));

  return { built, prunedPages, prunedAssets };
}
