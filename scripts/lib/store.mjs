// Read/write helpers for the JSON data files, shared by batch scripts and
// the admin server so there is exactly one place that knows the file shape.
import fs from "fs";
import {
  CONFIG_PATH, IMAGES_PATH, CATEGORIES_PATH, ARCHIVED_PATH, DATA_DIR,
} from "./paths.mjs";

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export const loadConfig = () => readJson(CONFIG_PATH, {});
export const saveConfig = (config) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

export const loadImages = () => readJson(IMAGES_PATH, []);
export const saveImages = (images) => writeJson(IMAGES_PATH, images);

export const loadArchived = () => readJson(ARCHIVED_PATH, []);
export const saveArchived = (images) => writeJson(ARCHIVED_PATH, images);

const DEFAULT_CATEGORIES = [
  { key: "landscapes", label: "Landscapes" },
];

export function loadCategories() {
  const cats = readJson(CATEGORIES_PATH, null);
  if (cats && cats.length) return cats;
  return DEFAULT_CATEGORIES;
}
export const saveCategories = (categories) => writeJson(CATEGORIES_PATH, categories);

// Make sure every image's category exists in categories.json (adds any
// missing ones at the end, in first-seen order) and every image has a
// sortIndex. Called after any bulk load so older data files self-migrate.
export function ensureCategoriesAndOrder(images, categories) {
  const known = new Set(categories.map((c) => c.key));
  for (const img of images) {
    if (img.category && !known.has(img.category)) {
      categories.push({ key: img.category, label: img.categoryLabel || img.category });
      known.add(img.category);
    }
  }
  images.forEach((img, i) => {
    if (typeof img.sortIndex !== "number") img.sortIndex = i;
  });
  images.sort((a, b) => a.sortIndex - b.sortIndex);
  return { images, categories };
}
