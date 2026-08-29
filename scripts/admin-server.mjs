// Local admin editor: serves the admin UI + a small JSON API for editing
// images.json/categories.json/archived.json, uploading new photos, and
// keeping dist/ in sync after every change. Not deployed - runs only on
// your own machine (`npm run admin`).
import fs from "fs";
import path from "path";
import http from "http";
import { SITE_DIR, SOURCE_DIR, DIST_DIR, CONFIG_PATH } from "./lib/paths.mjs";
import {
  loadConfig, saveConfig, loadImages, saveImages, loadArchived, saveArchived,
  loadCategories, saveCategories,
} from "./lib/store.mjs";
import { analyzeFile, classify, titleFromFilename } from "./lib/analyze.mjs";
import { processOneImage, removeDisplayAsset } from "./lib/process-image.mjs";
import { publish } from "./lib/publish.mjs";
import { saveAboutPhoto } from "./lib/about-photo.mjs";
import { processLogo } from "./lib/logo.mjs";

const ADMIN_DIR = path.join(SITE_DIR, "admin");
const PORT = process.env.ADMIN_PORT || 4321;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function nextId(images, archived) {
  let max = 0;
  for (const rec of [...images, ...archived]) {
    const m = /^img-(\d+)$/.exec(rec.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `img-${String(max + 1).padStart(3, "0")}`;
}

function nextSortIndex(images) {
  return images.reduce((m, i) => Math.max(m, i.sortIndex ?? -1), -1) + 1;
}

function safeFilename(name) {
  const base = path.basename(name).replace(/[^\w.\- ]/g, "_");
  let candidate = base;
  let i = 1;
  while (fs.existsSync(path.join(SOURCE_DIR, candidate))) {
    const ext = path.extname(base);
    const stem = base.slice(0, -ext.length);
    candidate = `${stem} (${i})${ext}`;
    i++;
  }
  return candidate;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 60 * 1024 * 1024) {
        reject(new Error("Upload too large (60MB limit)"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  return JSON.parse(buf.toString("utf8"));
}

function serveStatic(req, res, rootDir, urlPath) {
  const filePath = path.join(rootDir, urlPath);
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found: " + urlPath);
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ---------- route handlers ----------

async function handleState(req, res) {
  sendJson(res, 200, {
    config: loadConfig(),
    images: loadImages(),
    archived: loadArchived(),
    categories: loadCategories(),
  });
}

// The client owns the full board layout (it renders every column from one
// shared image list), so after ANY drag - reorder within a column or move
// to a different one - it just resends the complete desired state in one
// shot: the new global order, plus each card's current category. This
// avoids fragile server-side "insert at position N" math entirely.
async function handleReorder(req, res) {
  const { order } = await readJsonBody(req);
  // order: [{ id, category, categoryLabel }, ...] in the new global order
  const images = loadImages();
  const byId = new Map(images.map((i) => [i.id, i]));
  const reordered = [];
  for (const entry of order) {
    const img = byId.get(entry.id);
    if (!img) continue;
    img.category = entry.category;
    img.categoryLabel = entry.categoryLabel;
    reordered.push(img);
  }
  for (const img of images) if (!reordered.includes(img)) reordered.push(img);
  reordered.forEach((img, i) => (img.sortIndex = i));

  saveImages(reordered);
  const config = loadConfig();
  publish(reordered, config);
  sendJson(res, 200, { ok: true });
}

async function handlePatch(req, res, id) {
  const patch = await readJsonBody(req);
  const images = loadImages();
  const img = images.find((i) => i.id === id);
  if (!img) return sendJson(res, 404, { error: "not found" });

  const editable = ["title", "location", "story", "etsyUrl"];
  for (const key of editable) {
    if (key in patch) img[key] = patch[key];
  }
  if ("camera" in patch && typeof patch.camera === "object") {
    img.camera = { ...img.camera, ...patch.camera };
  }
  if (img.title && img.title.trim()) img.needsTitleReview = false;

  saveImages(images);
  const config = loadConfig();
  publish(images, config);
  sendJson(res, 200, { ok: true, image: img });
}

async function handleDelete(req, res, id) {
  const images = loadImages();
  const idx = images.findIndex((i) => i.id === id);
  if (idx === -1) return sendJson(res, 404, { error: "not found" });
  const [img] = images.splice(idx, 1);
  img.manualPublish = false;

  const archived = loadArchived();
  archived.push(img);
  saveArchived(archived);
  saveImages(images);
  removeDisplayAsset(id); // keep the thumb so the admin board can preview it

  const config = loadConfig();
  publish(images, config);
  sendJson(res, 200, { ok: true });
}

async function handleRestore(req, res, id) {
  const { category, categoryLabel } = await readJsonBody(req).catch(() => ({}));
  const archived = loadArchived();
  const idx = archived.findIndex((i) => i.id === id);
  if (idx === -1) return sendJson(res, 404, { error: "not found" });
  const [img] = archived.splice(idx, 1);
  img.manualPublish = true;
  if (category) {
    img.category = category;
    img.categoryLabel = categoryLabel || category;
  }

  const images = loadImages();
  img.sortIndex = nextSortIndex(images);
  images.push(img);
  saveImages(images);
  saveArchived(archived);

  const config = loadConfig();
  await processOneImage(img, config);
  publish(images, config);
  sendJson(res, 200, { ok: true, image: img });
}

async function handleUpload(req, res, url) {
  const filename = url.searchParams.get("filename") || "upload.jpg";
  const categoryKey = url.searchParams.get("category") || "landscapes";
  const categoryLabelParam = url.searchParams.get("categoryLabel") || categoryKey;

  if (!/\.(jpe?g)$/i.test(filename)) {
    return sendJson(res, 400, { error: "Only .jpg/.jpeg files are supported" });
  }

  const buf = await readBody(req);
  const savedName = safeFilename(filename);
  const destPath = path.join(SOURCE_DIR, savedName);
  fs.writeFileSync(destPath, buf);

  const analysis = await analyzeFile(destPath);
  const images = loadImages();
  const archived = loadArchived();
  const id = nextId(images, archived);
  const autoTitle = titleFromFilename(savedName);
  const auto = classify(savedName);

  const img = {
    id,
    file: savedName,
    slug: id,
    title: autoTitle || `Panorama ${id.replace("img-", "")}`,
    needsTitleReview: !autoTitle,
    category: categoryKey || auto.key,
    categoryLabel: categoryLabelParam || auto.label,
    isPanorama: analysis.isPano,
    width: analysis.width,
    height: analysis.height,
    aspect: Number(analysis.aspect.toFixed(3)),
    camera: analysis.exif,
    location: "",
    story: "",
    etsyUrl: "",
    sortIndex: nextSortIndex(images),
    manualPublish: true, // uploaded via the admin tool -> always publish it,
    // regardless of the automatic panoramic-ratio curation rule
  };

  images.push(img);
  saveImages(images);

  const categories = loadCategories();
  if (!categories.some((c) => c.key === img.category)) {
    categories.push({ key: img.category, label: img.categoryLabel });
    saveCategories(categories);
  }

  const config = loadConfig();
  await processOneImage(img, config);
  publish(images, config);

  sendJson(res, 200, { ok: true, image: img });
}

async function handleCategoryCreate(req, res) {
  const { label } = await readJsonBody(req);
  if (!label || !label.trim()) return sendJson(res, 400, { error: "label required" });
  const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const categories = loadCategories();
  if (categories.some((c) => c.key === key)) return sendJson(res, 409, { error: "gallery already exists" });
  categories.push({ key, label: label.trim() });
  saveCategories(categories);
  sendJson(res, 200, { ok: true, category: { key, label: label.trim() } });
}

async function handleCategoryRename(req, res, key) {
  const { label } = await readJsonBody(req);
  const categories = loadCategories();
  const cat = categories.find((c) => c.key === key);
  if (!cat) return sendJson(res, 404, { error: "not found" });
  cat.label = label;
  saveCategories(categories);

  const images = loadImages();
  let changed = false;
  for (const img of images) {
    if (img.category === key) {
      img.categoryLabel = label;
      changed = true;
    }
  }
  if (changed) {
    saveImages(images);
    publish(images, loadConfig());
  }
  sendJson(res, 200, { ok: true });
}

async function handleCategoryDelete(req, res, key) {
  const images = loadImages();
  if (images.some((i) => i.category === key)) {
    return sendJson(res, 409, { error: "Gallery still has photos in it - move them first" });
  }
  const categories = loadCategories().filter((c) => c.key !== key);
  saveCategories(categories);
  sendJson(res, 200, { ok: true });
}

async function handleCategoriesReorder(req, res) {
  const { order } = await readJsonBody(req);
  const categories = loadCategories();
  const byKey = new Map(categories.map((c) => [c.key, c]));
  const reordered = order.map((k) => byKey.get(k)).filter(Boolean);
  for (const c of categories) if (!order.includes(c.key)) reordered.push(c);
  saveCategories(reordered);
  sendJson(res, 200, { ok: true });
}

// Home page + About page settings all live in config.json. Since those two
// pages are rendered client-side from config.json at runtime (unlike the
// per-photo story pages), publishing a settings change just means copying
// the updated config into dist/data - no HTML regeneration needed.
function syncConfigToDist() {
  const distDataDir = path.join(DIST_DIR, "data");
  fs.mkdirSync(distDataDir, { recursive: true });
  fs.copyFileSync(CONFIG_PATH, path.join(distDataDir, "config.json"));
}

async function handleSettingsUpdate(req, res) {
  const patch = await readJsonBody(req);
  const config = loadConfig();
  if (patch.home) config.home = { ...config.home, ...patch.home };
  if (patch.about) config.about = { ...config.about, ...patch.about };
  if ("tagline" in patch) config.tagline = patch.tagline;
  if ("contactEmail" in patch) config.contactEmail = patch.contactEmail;
  if ("siteName" in patch) config.siteName = patch.siteName;
  if ("photographerName" in patch) config.photographerName = patch.photographerName;
  saveConfig(config);
  syncConfigToDist();
  sendJson(res, 200, { ok: true, config });
}

async function handleAboutPhotoUpload(req, res, url) {
  const filename = url.searchParams.get("filename") || "photo.jpg";
  const ext = path.extname(filename) || ".jpg";
  if (!/\.(jpe?g|png)$/i.test(ext)) {
    return sendJson(res, 400, { error: "Only .jpg/.jpeg/.png supported" });
  }
  const buf = await readBody(req);
  const savedName = await saveAboutPhoto(buf, ext);

  const config = loadConfig();
  config.about = { ...config.about, photo: savedName };
  saveConfig(config);
  syncConfigToDist();
  sendJson(res, 200, { ok: true, photo: savedName });
}

async function handleLogoUpload(req, res, url) {
  const filename = url.searchParams.get("filename") || "logo.jpg";
  const ext = path.extname(filename) || ".jpg";
  if (!/\.(jpe?g|png)$/i.test(ext)) {
    return sendJson(res, 400, { error: "Only .jpg/.jpeg/.png supported" });
  }
  const buf = await readBody(req);
  await processLogo(buf, ext);

  const config = loadConfig();
  config.branding = { ...config.branding, hasLogo: true };
  saveConfig(config);
  syncConfigToDist();
  sendJson(res, 200, { ok: true });
}

async function handleLogoRemove(req, res) {
  const config = loadConfig();
  config.branding = { ...config.branding, hasLogo: false };
  saveConfig(config);
  syncConfigToDist();
  sendJson(res, 200, { ok: true });
}

// ---------- router ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  try {
    if (p === "/api/state" && req.method === "GET") return await handleState(req, res);
    if (p === "/api/images/reorder" && req.method === "POST") return await handleReorder(req, res);
    if (p === "/api/images/upload" && req.method === "POST") return await handleUpload(req, res, url);
    if (p.startsWith("/api/images/") && p.endsWith("/restore") && req.method === "POST") {
      return await handleRestore(req, res, p.split("/")[3]);
    }
    if (p.startsWith("/api/images/") && req.method === "PATCH") {
      return await handlePatch(req, res, p.split("/")[3]);
    }
    if (p.startsWith("/api/images/") && req.method === "DELETE") {
      return await handleDelete(req, res, p.split("/")[3]);
    }
    if (p === "/api/settings" && req.method === "POST") return await handleSettingsUpdate(req, res);
    if (p === "/api/about-photo/upload" && req.method === "POST") return await handleAboutPhotoUpload(req, res, url);
    if (p === "/api/logo/upload" && req.method === "POST") return await handleLogoUpload(req, res, url);
    if (p === "/api/logo" && req.method === "DELETE") return await handleLogoRemove(req, res);
    if (p === "/api/categories" && req.method === "POST") return await handleCategoryCreate(req, res);
    if (p === "/api/categories/reorder" && req.method === "POST") return await handleCategoriesReorder(req, res);
    if (p.startsWith("/api/categories/") && req.method === "PATCH") {
      return await handleCategoryRename(req, res, decodeURIComponent(p.split("/")[3]));
    }
    if (p.startsWith("/api/categories/") && req.method === "DELETE") {
      return await handleCategoryDelete(req, res, decodeURIComponent(p.split("/")[3]));
    }

    // static: admin UI, plus dist/ assets for thumbnail/display previews
    if (p.startsWith("/assets/")) return serveStatic(req, res, DIST_DIR, p);
    if (p === "/" || p === "") return serveStatic(req, res, ADMIN_DIR, "/index.html");
    return serveStatic(req, res, ADMIN_DIR, p);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Admin editor running at http://localhost:${PORT}`);
  console.log(`(Run "npm run serve" separately to preview the live site on :8080)`);
});
