// Processes the photographer's About-page portrait: no watermark (it's not
// for sale), modest resolution since it's shown small and circular-cropped.
// The original upload is kept in site/uploads/ so it's never lost even
// though dist/ is fully regenerated output.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { SITE_DIR, DIST_DIR } from "./paths.mjs";

const UPLOADS_DIR = path.join(SITE_DIR, "uploads");
const ABOUT_PHOTO_NAME = "about-photo.jpg";

export async function saveAboutPhoto(buffer, originalExt) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, `about-photo-original${originalExt}`), buffer);

  const distAssetsDir = path.join(DIST_DIR, "assets");
  fs.mkdirSync(distAssetsDir, { recursive: true });
  await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 900, height: 900, fit: "cover" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(distAssetsDir, ABOUT_PHOTO_NAME));

  return ABOUT_PHOTO_NAME;
}
