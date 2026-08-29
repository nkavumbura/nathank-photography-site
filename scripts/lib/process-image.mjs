// Resizes + watermarks one source photo into dist/assets/display and a
// thumbnail into dist/assets/thumbs. Shared by the batch processor and the
// admin server (so uploading one new photo doesn't require reprocessing
// all of them).
//
// Thumbnails are kept for BOTH published and archived photos (so the admin
// board can show a preview of hidden/archived images too); the larger
// "display" copy only exists for published photos.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { SOURCE_DIR, DISPLAY_DIR, THUMB_DIR } from "./paths.mjs";

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function watermarkSvg(width, height, text) {
  const fontSize = Math.max(14, Math.round(width * 0.016));
  const padding = Math.round(fontSize * 1.2);
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .wm { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: ${fontSize}px;
              fill: #ffffff; fill-opacity: 0.55; }
        .wm-shadow { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: ${fontSize}px;
              fill: #000000; fill-opacity: 0.35; }
      </style>
      <text x="${width - padding + 1}" y="${height - padding + 1}" text-anchor="end" class="wm-shadow">${escapeXml(text)}</text>
      <text x="${width - padding}" y="${height - padding}" text-anchor="end" class="wm">${escapeXml(text)}</text>
    </svg>
  `);
}

function thumbSize(img, config) {
  const isWide = img.width >= img.height;
  return isWide
    ? { width: Math.min(img.width, config.thumbLongEdge) }
    : { height: Math.min(img.height, config.thumbLongEdge) };
}

export async function processThumbOnly(img, config) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  const srcPath = path.join(SOURCE_DIR, img.file);
  const thumbPath = path.join(THUMB_DIR, `${img.id}.jpg`);
  await sharp(srcPath, { failOn: "none" })
    .rotate()
    .resize({ ...thumbSize(img, config), withoutEnlargement: true })
    .jpeg({ quality: config.thumbQuality, mozjpeg: true })
    .toFile(thumbPath);
}

export async function processOneImage(img, config) {
  fs.mkdirSync(DISPLAY_DIR, { recursive: true });
  fs.mkdirSync(THUMB_DIR, { recursive: true });

  const srcPath = path.join(SOURCE_DIR, img.file);
  const displayPath = path.join(DISPLAY_DIR, `${img.id}.jpg`);
  const thumbPath = path.join(THUMB_DIR, `${img.id}.jpg`);

  const longEdgeCap = img.isPanorama
    ? config.displayLongEdgePanorama
    : config.displayLongEdgeStandard;
  const isWide = img.width >= img.height;
  const resizeOpts = isWide
    ? { width: Math.min(img.width, longEdgeCap) }
    : { height: Math.min(img.height, longEdgeCap) };

  const base = sharp(srcPath, { failOn: "none" }).rotate().resize({
    ...resizeOpts,
    withoutEnlargement: true,
  });

  const meta = await base.clone().toBuffer({ resolveWithObject: true });
  const { width: outW, height: outH } = meta.info;

  await sharp(meta.data)
    .composite([{ input: watermarkSvg(outW, outH, config.watermarkText), top: 0, left: 0 }])
    .jpeg({ quality: config.jpegQuality, mozjpeg: true })
    .toFile(displayPath);

  const thumbLongEdge = config.thumbLongEdge;
  const thumbResize = isWide
    ? { width: Math.min(outW, thumbLongEdge) }
    : { height: Math.min(outH, thumbLongEdge) };
  await sharp(meta.data)
    .resize({ ...thumbResize, withoutEnlargement: true })
    .jpeg({ quality: config.thumbQuality, mozjpeg: true })
    .toFile(thumbPath);
}

// Removes display/thumb files for ids that appear in neither list. Pass
// every published id as `keepDisplayIds` and published+archived as
// `keepThumbIds` so archived photos keep their preview thumbnail.
export function pruneOrphanedAssets(keepDisplayIds, keepThumbIds = keepDisplayIds) {
  const pruned = [];
  const prune = (dir, keepIds) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(img-[\w-]+)\.jpg$/);
      if (m && !keepIds.has(m[1])) {
        fs.unlinkSync(path.join(dir, f));
        pruned.push(path.join(path.basename(dir), f));
      }
    }
  };
  prune(DISPLAY_DIR, keepDisplayIds);
  prune(THUMB_DIR, keepThumbIds);
  return pruned;
}

// Called when a published photo is archived: drop the large display copy
// (it's no longer shown on the site) but keep the thumb for the admin board.
export function removeDisplayAsset(id) {
  const p = path.join(DISPLAY_DIR, `${id}.jpg`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
