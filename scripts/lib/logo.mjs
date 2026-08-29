// Extracts a glow-on-dark logo graphic onto a transparent background (so it
// composites cleanly onto the site's own dark header) by turning per-pixel
// brightness into alpha, then trims to the glow's bounding box and writes a
// header-sized logo plus a square favicon. The original upload is kept in
// site/uploads/ since dist/ is fully regenerated output.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { SITE_DIR, DIST_DIR } from "./paths.mjs";

const UPLOADS_DIR = path.join(SITE_DIR, "uploads");

// Calibrated against this logo's dark textured background (peak ~20-45)
// and glow bloom (soft falloff out to ~200+): background floor mapped to
// fully transparent, glow core mapped to fully opaque.
const FLOOR = 45;
const CEILING = 190;

export async function processLogo(buffer, originalExt) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, `logo-original${originalExt}`), buffer);

  const { data, info } = await sharp(buffer, { failOn: "none" })
    .rotate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < data.length; i += channels, p += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = Math.max(r, g, b);
    const alpha = Math.max(0, Math.min(255, Math.round(((lum - FLOOR) / (CEILING - FLOOR)) * 255)));
    rgba[p] = r;
    rgba[p + 1] = g;
    rgba[p + 2] = b;
    rgba[p + 3] = alpha;
  }

  const cutout = sharp(rgba, { raw: { width, height, channels: 4 } }).png();
  const trimmed = await cutout.clone().trim({ threshold: 8 }).toBuffer();

  const distAssetsDir = path.join(DIST_DIR, "assets");
  fs.mkdirSync(distAssetsDir, { recursive: true });

  // Header logo: modest height, plenty of resolution for retina displays.
  await sharp(trimmed).resize({ height: 240, withoutEnlargement: true }).png().toFile(path.join(distAssetsDir, "logo.png"));

  // Favicon: pad to square on a transparent canvas so it isn't stretched.
  const meta = await sharp(trimmed).metadata();
  const side = Math.max(meta.width, meta.height);
  await sharp(trimmed)
    .resize({ height: 420, withoutEnlargement: true })
    .toBuffer()
    .then((buf) =>
      sharp(buf)
        .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(DIST_DIR, "favicon.png"))
    );

  return { width: meta.width, height: meta.height };
}
