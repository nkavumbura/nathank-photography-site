// Batch version: resizes + watermarks every published image, and makes
// sure every archived image has at least a thumbnail (so the admin board
// can preview hidden photos). Originals in the parent Portfolio folder are
// never modified. For a single new photo, the admin server calls
// lib/process-image.mjs directly instead of this.
import fs from "fs";
import path from "path";
import { loadConfig, loadImages, loadArchived } from "./lib/store.mjs";
import { processOneImage, processThumbOnly, pruneOrphanedAssets } from "./lib/process-image.mjs";
import { THUMB_DIR } from "./lib/paths.mjs";

const config = loadConfig();
const images = loadImages();
const archived = loadArchived();

const publishedIds = new Set(images.map((i) => i.id));
const archivedIds = new Set(archived.map((i) => i.id));
const pruned = pruneOrphanedAssets(publishedIds, new Set([...publishedIds, ...archivedIds]));
for (const f of pruned) console.log(`Pruned orphaned ${f}`);

let done = 0;
for (const img of images) {
  await processOneImage(img, config);
  done++;
  if (done % 20 === 0) console.log(`Processed ${done}/${images.length}`);
}
console.log(`Done. Processed ${done} published images.`);

let thumbed = 0;
for (const img of archived) {
  if (fs.existsSync(path.join(THUMB_DIR, `${img.id}.jpg`))) continue;
  await processThumbOnly(img, config);
  thumbed++;
}
if (thumbed) console.log(`Backfilled thumbnails for ${thumbed} archived images.`);
