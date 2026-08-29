// Scans the portfolio folder, extracts EXIF, de-dupes size/edit variants,
// classifies images into categories, and writes data/images.json.
// Does NOT touch or delete any source files.

import fs from "fs";
import path from "path";
import {
  dedupeKey, qualityScore, titleFromFilename, classify, analyzeFile,
} from "./lib/analyze.mjs";
import { SOURCE_DIR, EXCLUDED_DUPES_PATH } from "./lib/paths.mjs";
import {
  loadImages, saveImages, loadArchived, saveArchived,
  loadCategories, saveCategories, ensureCategoriesAndOrder,
} from "./lib/store.mjs";

const files = fs
  .readdirSync(SOURCE_DIR, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name)
  .filter((n) => /\.(jpe?g)$/i.test(n))
  .filter((n) => !n.startsWith("._") && !n.startsWith("."))
  .sort();

console.log(`Found ${files.length} source images.`);

// ---------- pass 1: read metadata for every file ----------

const records = [];
for (const file of files) {
  const full = path.join(SOURCE_DIR, file);
  const a = await analyzeFile(full);
  records.push({
    file,
    key: dedupeKey(file),
    score: qualityScore(file),
    ...a,
  });
}

// ---------- pass 2: group duplicates, pick canonical ----------

const groups = new Map();
for (const r of records) {
  if (!groups.has(r.key)) groups.set(r.key, []);
  groups.get(r.key).push(r);
}

const canonical = [];
const excluded = [];
for (const [, group] of groups) {
  if (group.length === 1) {
    canonical.push(group[0]);
    continue;
  }
  group.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.width * b.height !== a.width * a.height) return b.width * b.height - a.width * a.height;
    return b.bytes - a.bytes;
  });
  canonical.push(group[0]);
  for (const loser of group.slice(1)) {
    excluded.push({ file: loser.file, keptInstead: group[0].file });
  }
}

console.log(`Canonical images: ${canonical.length}. Excluded as duplicates: ${excluded.length}.`);

// ---------- pass 3: build final manifest entries ----------
// Preserve every hand-edited field (title/location/story/etsyUrl/category/
// sortIndex) from a previous run - including the admin tool's edits - so
// re-running this script (e.g. after adding new photos to the folder) never
// clobbers curation work. Only brand-new files get auto-classified.

const oldByFile = new Map();
for (const rec of [...loadImages(), ...loadArchived()]) oldByFile.set(rec.file, rec);

let maxIdNum = 0;
for (const rec of oldByFile.values()) {
  const m = /^img-(\d+)$/.exec(rec.id);
  if (m) maxIdNum = Math.max(maxIdNum, Number(m[1]));
}
let maxSortIndex = -1;
for (const rec of oldByFile.values()) {
  if (typeof rec.sortIndex === "number") maxSortIndex = Math.max(maxSortIndex, rec.sortIndex);
}

const allImages = canonical
  .sort((a, b) => a.file.localeCompare(b.file))
  .map((r) => {
    const prev = oldByFile.get(r.file);
    const autoCategory = classify(r.file);
    const id = prev?.id || `img-${String(++maxIdNum).padStart(3, "0")}`;
    const sortIndex = typeof prev?.sortIndex === "number" ? prev.sortIndex : ++maxSortIndex;
    const autoTitle = titleFromFilename(r.file) || `Panorama ${id.replace("img-", "")}`;
    return {
      id,
      file: r.file,
      slug: id,
      title: prev?.title || autoTitle,
      needsTitleReview: prev ? prev.needsTitleReview : !titleFromFilename(r.file),
      category: prev?.category || autoCategory.key,
      categoryLabel: prev?.categoryLabel || autoCategory.label,
      isPanorama: r.isPano,
      width: r.width,
      height: r.height,
      aspect: Number(r.aspect.toFixed(3)),
      camera: prev?.camera || r.exif,
      location: prev?.location || "",
      story: prev?.story || prev?.description || "",
      etsyUrl: prev?.etsyUrl || "",
      sortIndex,
      manualPublish: prev?.manualPublish,
    };
  });

// Curate: the published site only shows genuinely panoramic-format photos,
// UNLESS a human (via the admin tool) already made a call either way -
// `manualPublish` overrides the automatic ratio-based curation.
const images = allImages.filter((i) => i.manualPublish ?? i.isPanorama);
const archived = allImages.filter((i) => !(i.manualPublish ?? i.isPanorama));

const { images: sortedImages, categories } = ensureCategoriesAndOrder(images, loadCategories());

saveImages(sortedImages);
saveArchived(archived);
saveCategories(categories);
fs.writeFileSync(EXCLUDED_DUPES_PATH, JSON.stringify(excluded, null, 2));

const categoryCounts = {};
for (const img of sortedImages) categoryCounts[img.categoryLabel] = (categoryCounts[img.categoryLabel] || 0) + 1;
console.log("Category breakdown (published panoramas only):", categoryCounts);
console.log(`Wrote ${sortedImages.length} images to data/images.json`);
console.log(`Archived ${archived.length} non-panoramic images to data/archived.json (not deleted)`);
