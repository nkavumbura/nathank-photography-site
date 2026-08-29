import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SITE_DIR = path.resolve(__dirname, "..", "..");
export const SOURCE_DIR = path.resolve(SITE_DIR, "..");
export const DIST_DIR = path.join(SITE_DIR, "dist");
export const DISPLAY_DIR = path.join(DIST_DIR, "assets", "display");
export const THUMB_DIR = path.join(DIST_DIR, "assets", "thumbs");
export const PHOTO_DIR = path.join(DIST_DIR, "photo");
export const DATA_DIR = path.join(SITE_DIR, "data");
export const CONFIG_PATH = path.join(SITE_DIR, "config.json");
export const IMAGES_PATH = path.join(DATA_DIR, "images.json");
export const CATEGORIES_PATH = path.join(DATA_DIR, "categories.json");
export const ARCHIVED_PATH = path.join(DATA_DIR, "archived.json");
export const EXCLUDED_DUPES_PATH = path.join(DATA_DIR, "excluded-duplicates.json");
