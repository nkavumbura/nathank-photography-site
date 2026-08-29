// One-off: fills in `location` for images whose title is already an
// unambiguous, well-known place name (the photographer's own filename).
// Safe to re-run; only fills blanks, never overwrites existing text.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "..", "data", "images.json");
const images = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const LOCATIONS = [
  [/^Adelaide Cityscape$/i, "Adelaide, South Australia, Australia"],
  [/^Anawhata$/i, "Anawhata Beach, Waitākere Ranges, Auckland, New Zealand"],
  [/^Ashburton Lakes$/i, "Ashburton Lakes, Canterbury, New Zealand"],
  [/^Auckland Cityscape Westhaven Marina/i, "Westhaven Marina, Auckland, New Zealand"],
  [/^Auckland reflections$/i, "Auckland, New Zealand"],
  [/^Castle Hill Reflections$/i, "Castle Hill, Canterbury, New Zealand"],
  [/^Cornwall Park Path$/i, "Cornwall Park, Auckland, New Zealand"],
  [/^Cyril Bassett VC Lookout$/i, "Auckland, New Zealand"],
  [/^Fiji fire dance$/i, "Fiji"],
  [/^Hooker Valley$/i, "Hooker Valley Track, Aoraki/Mount Cook National Park, New Zealand"],
  [/^Huka Falls fury$/i, "Huka Falls, Taupō, New Zealand"],
  [/^Karekare Falls$/i, "Karekare, Waitākere Ranges, Auckland, New Zealand"],
  [/^Lake Heron$/i, "Lake Heron, Canterbury, New Zealand"],
  [/Lake Matheson/i, "Lake Matheson, West Coast, New Zealand"],
  [/^Lindis Pass$/i, "Lindis Pass, Otago, New Zealand"],
  [/^Lion City's DNA$/i, "Singapore"],
  [/^Milky Way over Magazine Bay$/i, "Magazine Bay, Devonport, Auckland, New Zealand"],
  [/^Moody Auckland City$/i, "Auckland, New Zealand"],
  [/^Mt Sefton Meuller Lake/i, "Mueller Lake, Aoraki/Mount Cook National Park, New Zealand"],
  [/^First Light on Mt Sefton$/i, "Aoraki/Mount Cook National Park, New Zealand"],
  [/^Muriwai on the rocks$/i, "Muriwai Beach, Auckland, New Zealand"],
  [/^Narnia Cathedral Cove$/i, "Cathedral Cove, Coromandel, New Zealand"],
  [/^Pebble Bay Pauanui$/i, "Pauanui, Coromandel, New Zealand"],
  [/^Piha$/i, "Piha Beach, Auckland, New Zealand"],
  [/^Point England Reserve$/i, "Point England Reserve, Auckland, New Zealand"],
  [/Pukaki/i, "Lake Pukaki, Mackenzie Basin, New Zealand"],
  [/^Queens Wharf$/i, "Queens Wharf, Auckland, New Zealand"],
  [/^Road to Mt Cook$/i, "Aoraki/Mount Cook National Park, New Zealand"],
  [/^Sky Tower/i, "Sky Tower, Auckland, New Zealand"],
  [/^Sunrise on Desert Road$/i, "Desert Road, Central Plateau, New Zealand"],
  [/^Taranaki Falls$/i, "Taranaki Falls, Tongariro National Park, New Zealand"],
  [/^Tasman Lake$/i, "Tasman Lake, Aoraki/Mount Cook National Park, New Zealand"],
  [/^Victoria Falls$/i, "Victoria Falls, Zambia / Zimbabwe"],
  [/^Westminster London$/i, "Westminster, London, United Kingdom"],
];

let filled = 0;
for (const img of images) {
  if (img.location) continue;
  const match = LOCATIONS.find(([re]) => re.test(img.title));
  if (match) {
    img.location = match[1];
    filled++;
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(images, null, 2));
console.log(`Filled location for ${filled} images.`);
