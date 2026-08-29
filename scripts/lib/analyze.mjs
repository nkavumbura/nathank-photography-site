// Filename/EXIF analysis shared by the batch manifest builder and the
// admin server's single-file upload handler, so both classify images
// identically.
import fs from "fs";
import sharp from "sharp";
import exifr from "exifr";

export function stripExt(name) {
  return name.replace(/\.(jpe?g)$/i, "");
}

// Normalize a filename to a "same shot" grouping key by stripping known
// edit/size/export qualifiers. Conservative: only strips well-known tokens.
export function dedupeKey(name) {
  let base = stripExt(name);
  base = base
    .replace(/\bWeb\b/gi, "")
    .replace(/\bSmugmug\b/gi, "")
    .replace(/\bCompressed\b/gi, "")
    .replace(/\bAdobe ?RGB\b/gi, "")
    .replace(/Full ?Size\b/gi, "")
    .replace(/Half ?Size\b/gi, "")
    .replace(/Quarter ?Size\b/gi, "")
    .replace(/Original\b/gi, "")
    .replace(/\bsmall\b/gi, "")
    .replace(/\bsm\b/gi, "")
    .replace(/-Edit\b/gi, "")
    .replace(/\bEdit\b/gi, "")
    .replace(/-\d+$/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  return base;
}

export function qualityScore(name) {
  let score = 0;
  if (/\bWeb\b/i.test(name)) score -= 5;
  if (/\bsmall\b|\bsm\b/i.test(name)) score -= 5;
  if (/\bCompressed\b/i.test(name)) score -= 5;
  if (/Quarter ?Size\b/i.test(name)) score -= 10;
  if (/Half ?Size\b/i.test(name)) score -= 4;
  if (/Full ?Size\b|Original\b/i.test(name)) score += 3;
  if (/-Edit-Edit\b/i.test(name)) score += 2;
  else if (/-Edit\b/i.test(name)) score += 1;
  return score;
}

export function titleFromFilename(name) {
  let t = stripExt(name);
  if (/\d+\s*images/i.test(t) || /^\[?Group/i.test(t) || /^NK\[?Group/i.test(t)) {
    return null; // Lightroom/PTGui auto-stitch export, not a human title
  }
  t = t.replace(/_s\b/gi, "'s");
  t = t.replace(/(?<=[a-z])(Original|Half ?Size|Quarter ?Size|Full ?Size)\b/g, " $1");
  t = t.replace(/\d{5,}/g, "");
  t = t.replace(
    /\b(HDR|Panorama|Pano|Vertorama|Edit|Web|Smugmug|Compressed|Small|Full ?Size|Half ?Size|Quarter ?Size|Original|Adobe ?RGB)\b/gi,
    ""
  );
  t = t.replace(/\bsm\b/gi, "");
  t = t.replace(/^Final\b/i, "");
  t = t.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

  const bare = t.replace(/[\s._-]/g, "");
  if (!bare || bare.length <= 2 || /^(0F7A|1Q5A|IMG)/i.test(bare)) {
    return null;
  }
  if (t === t.toLowerCase()) {
    t = t.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return t.trim();
}

export const CATEGORY_RULES = [
  { key: "night-sky", label: "Night Sky", test: /milky way|supermoon|blue hour|two suns|star/i },
  { key: "waterfalls", label: "Waterfalls", test: /falls|huka/i },
  { key: "fire", label: "Fire & Motion", test: /fire|dance/i },
  { key: "cityscapes", label: "Cityscapes", test: /cityscape|sky tower|westhaven|queens wharf|city|westminster|adelaide|marina/i },
  { key: "coast", label: "Coast & Beaches", test: /beach|piha|muriwai|karekare|anawhata|pebble bay|lagoon|cathedral cove|narnia|pauanui/i },
  { key: "alpine", label: "Alpine & Lakes", test: /lake|mt |mount|sefton|pukaki|tasman|matheson|heron|hooker|ashburton|castle hill|lindis|road to mt cook|alpine/i },
  { key: "travel", label: "Travel", test: /fiji|london|cornwall|lion city|victoria falls/i },
  { key: "middle-earth", label: "Middle-earth Country", test: /rohan|mordor|kazad|shire|hobbit/i },
  { key: "details", label: "Details & Nature", test: /flower|cycad|reflection|mirror/i },
];

export function classify(name) {
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(name)) return rule;
  }
  return { key: "landscapes", label: "Landscapes" };
}

export function fmtShutter(exposureTime) {
  if (!exposureTime) return null;
  if (exposureTime >= 1) return `${exposureTime}s`;
  const denom = Math.round(1 / exposureTime);
  return `1/${denom}s`;
}

// The standard photography threshold for "panoramic": long side at least 2x
// the short side, regardless of orientation (catches tall vertoramas too).
export const PANO_RATIO_THRESHOLD = 2.0;

export async function analyzeFile(fullPath) {
  let meta = {};
  let exif = {};
  let gps = null;
  try {
    meta = await sharp(fullPath).metadata();
  } catch (e) {
    console.warn(`sharp metadata failed for ${fullPath}: ${e.message}`);
  }
  try {
    exif = (await exifr.parse(fullPath, { pick: [
      "Make", "Model", "LensModel", "FNumber", "ExposureTime", "ISO",
      "FocalLength", "FocalLengthIn35mmFormat", "DateTimeOriginal",
    ] })) || {};
  } catch (e) {
    // many exported JPEGs strip EXIF entirely; that's fine
  }
  try {
    gps = await exifr.gps(fullPath);
  } catch (e) {
    // no GPS block; that's fine
  }

  const width = meta.width || 0;
  const height = meta.height || 0;
  const orientation = meta.orientation;
  const swapped = orientation && orientation >= 5;
  const w = swapped ? height : width;
  const h = swapped ? width : height;
  const aspect = h ? w / h : 0;
  const ratio = w && h ? Math.max(w, h) / Math.min(w, h) : 0;
  const isPano = ratio >= PANO_RATIO_THRESHOLD;

  return {
    width: w,
    height: h,
    aspect,
    ratio,
    isPano,
    bytes: fs.statSync(fullPath).size,
    exif: {
      make: exif.Make || null,
      model: exif.Model || null,
      lens: exif.LensModel || null,
      aperture: exif.FNumber ? `f/${exif.FNumber}` : null,
      shutter: fmtShutter(exif.ExposureTime),
      iso: exif.ISO || null,
      focalLength: exif.FocalLengthIn35mmFormat
        ? `${Math.round(exif.FocalLengthIn35mmFormat)}mm`
        : exif.FocalLength
        ? `${Math.round(exif.FocalLength)}mm`
        : null,
      date: exif.DateTimeOriginal || null,
      gps: gps ? { lat: gps.latitude, lon: gps.longitude } : null,
    },
  };
}
