// One-off: applies hand-written titles/locations/stories for images that
// had generic "Panorama NNN" placeholders, based on visual review of each
// thumbnail. Only fills title/location/story - never touches category,
// order, or anything else. Safe to re-run (idempotent).
import { loadImages, saveImages } from "./lib/store.mjs";
import { loadConfig } from "./lib/store.mjs";
import { publish } from "./lib/publish.mjs";

const UPDATES = {
  // ---------- Cityscapes ----------
  "img-002": { title: "Westhaven at Rest", location: "Westhaven Marina, Auckland, New Zealand", story: "Before the city properly wakes, the marina is just masts and stillness — hundreds of boats waiting, the Sky Tower keeping watch in the distance." },
  "img-008": { title: "The Long Walk Out", location: "Auckland, New Zealand", story: "A concrete ramp running straight out into the harbour, one person sitting at the end of it, the whole city glowing pink and distant. There's a particular kind of loneliness that only shows up at dusk." },
  "img-046": { title: "Steel Against the Dark", location: "Auckland Harbour Bridge, New Zealand", story: "Stripped of colour, the bridge becomes pure structure — arcs of light holding up the night, the city glinting faintly through its ribs." },
  "img-044": { title: "Adelaide, Blue Hour", location: "Adelaide, South Australia, Australia", story: "The Torrens goes still and mirror-flat right as the convention centre lights click on — that narrow window where the sky is still blue but the city already looks like nightfall." },
  "img-038": { title: "City Lights, Still Water", location: "Auckland, New Zealand", story: "The Sky Tower catches the last colour in the sky while the harbour holds it all in reflection, twice over." },
  "img-092": { title: "The Beehive in Bloom", location: "Wellington, New Zealand", story: "A pōhutukawa in full red flower stands guard over the seat of government — an unexpectedly soft frame for one of the country's most recognisable buildings." },
  "img-134": { title: "Rush Hour, Slow Water", location: "Westhaven, Auckland, New Zealand", story: "Traffic streaks past in a blur of light while, just metres away, a thousand yacht masts don't move at all. Two speeds of the same evening." },
  "img-049": { title: "Boats Beneath the Bridge", location: "Auckland Harbour Bridge, New Zealand", story: "Small yachts at anchor, dwarfed by the bridge's long red glow — a quiet foreground for something this big." },
  "img-045": { title: "Underneath", location: "Auckland Harbour Bridge, New Zealand", story: "Looking straight up into the trusswork as the lights come on, the bridge stops being a way to cross the harbour and becomes architecture in its own right." },
  "img-014": { title: "Moonrise Over the Marina", location: "Auckland, New Zealand", story: "A full moon hangs over the skyline while the motorway below streaks red and white — one slow light in the sky, thousands of fast ones on the ground." },
  "img-017": { title: "A Forest of Masts", location: "Westhaven Marina, Auckland, New Zealand", story: "Hundreds of bare masts stand black against a bruised purple sky, the city just a smudge of light behind them." },
  "img-015": { title: "Flying Colours", location: "Auckland Harbour Bridge, New Zealand", story: "Looking up through the trees as traffic streams beneath the flags — an angle that makes even a daily commute look like an occasion." },
  "img-031": { title: "Last Light on the Bridge", location: "Auckland Harbour Bridge, New Zealand", story: "The last warm colour of the day catches the underside of the arch, the Sky Tower glowing faintly through the gap." },
  "img-024": { title: "The Quiet Memorial", location: "One Tree Hill / Maungakiekie, Auckland, New Zealand", story: "An obelisk and a formal garden, empty and still at dusk — the kind of place that asks you to slow down without saying why." },
  "img-037": { title: "Vertical City", location: "Auckland, New Zealand", story: "Traffic drags long streaks of colour down the street while the Sky Tower stands perfectly still above it, unbothered by the rush below." },
  "img-025": { title: "Streets of Light", location: "Auckland, New Zealand", story: "The same tower, a different night — this time the city exhales in ribbons of red and gold, funnelled straight downhill." },
  "img-003": { title: "Gathering Clouds Over the City", location: "Auckland, New Zealand", story: "A heavy sky pressing down on the skyline, the water gone flat and grey beneath it — the calm that sits just before weather changes." },
  "img-004": { title: "Evening Commute", location: "Westhaven, Auckland, New Zealand", story: "The marina settles into blue-hour quiet while the motorway keeps moving — everyone else's evening still underway." },

  // ---------- Landscapes ----------
  "img-009": { title: "Storm Light on the Divide", location: "Canterbury high country, New Zealand", story: "Snow on the peaks, storm cloud stacking up behind them, and a single road threading through the middle of it all. The kind of country that makes you feel appropriately small." },
  "img-010": { title: "The Valley That Feels Like Legend", location: "Canterbury high country, New Zealand", story: "A braided river, a lone conical peak, and nothing else for miles — this stretch of high country has a way of looking like it belongs in someone else's story." },
  "img-016": { title: "Guardians of the Cove", location: "Cathedral Cove, Coromandel, New Zealand", story: "A sea stack standing sentry over turquoise water and pale cliffs — one of the most photographed coves in the country, and still worth the walk in." },
  "img-023": { title: "Winter on the Cone", location: "Tongariro National Park, New Zealand", story: "Fresh snow on a perfectly symmetrical volcano, with nothing but frozen scoria in every direction. It's easy to see why this mountain has played bigger roles than itself." },
  "img-047": { title: "Where the Glacier Ends", location: "Hooker Valley, Aoraki/Mount Cook National Park, New Zealand", story: "A milky glacial lake sitting at the foot of Aoraki, fed by ice that's been retreating for decades. Beautiful and quietly sobering at the same time." },
  "img-048": { title: "Ice Blue, Sky Blue", location: "Hooker Valley, Aoraki/Mount Cook National Park, New Zealand", story: "Same valley, same lake, a different hour — the kind of blue that only glacial silt can make." },
  "img-052": { title: "The Road to Aoraki", location: "Lake Pukaki, Mackenzie Basin, New Zealand", story: "Impossibly turquoise water leading the eye straight to the country's tallest peak — one of the classic New Zealand views, and it never quite stops being one." },
  "img-054": { title: "Pukaki at Dusk", location: "Lake Pukaki, Mackenzie Basin, New Zealand", story: "The colour drains out of the sky in slow motion here — pink fading to blue, the mountains going from gold to grey to silhouette." },
  "img-055": { title: "Golden Shoreline", location: "Mackenzie Country, New Zealand", story: "A curved gravel bay catching the last of the day's light, mountains standing quietly along the far shore." },
  "img-056": { title: "Wind Over the Paddocks", location: "Hauraki Gulf coastline, New Zealand", story: "Green farmland rolling down to the water, wisps of high cloud streaking overhead — a working landscape that happens to be beautiful too." },
  "img-074": { title: "Taranaki, Twice", location: "Lake Mangamahoe, Taranaki, New Zealand", story: "On a still day the lake gives you the mountain twice over — once in the sky, once in the water, bush framing it both ways." },
  "img-081": { title: "That Tree, Alone", location: "Lake Wanaka, New Zealand", story: "One willow, one lake, a thousand photographs before this one — and it still holds up in black and white, still and solitary against the water." },
  "img-086": { title: "Sunburst at Cathedral Cove", location: "Cathedral Cove, Coromandel, New Zealand", story: "The sun breaks right over the sea stack, the wet sand throwing the whole scene back at itself." },
  "img-102": { title: "The Road to the Mountain", location: "Desert Road, Central Plateau, New Zealand", story: "A ribbon of road pointed straight at a snow-capped volcano — one of the great drives, best seen right as the light starts to fade." },
  "img-103": { title: "Two Giants at Twilight", location: "Desert Road, Central Plateau, New Zealand", story: "Ruapehu on one side, Ngauruhoe on the other, and the whole plateau caught in that brief window between day and proper dark." },
  "img-104": { title: "First Light on Ruapehu", location: "Tongariro National Park, New Zealand", story: "The very first colour of the day landing on the summit, everything below it still in shadow." },
  "img-105": { title: "Alpenglow on the Volcano", location: "Tongariro National Park, New Zealand", story: "That brief pink flush of alpenglow across the cone, the road curving away toward it like an invitation." },
  "img-106": { title: "Still Water, Otago", location: "Otago, New Zealand", story: "Jagged peaks laid flat on glassy water, a quiet grassy point reaching out into the lake — the kind of scene that makes you stop talking." },
  "img-005": { title: "Black Sand, Green Rock", location: "Auckland's west coast, New Zealand", story: "Volcanic sand, algae-slicked rocks, and a towering eroded cliff — the raw, unpolished side of Auckland's coastline." },
  "img-116": { title: "Through the Sea Cave", location: "Auckland's west coast, New Zealand", story: "A cave mouth framing a black-sand beach and a distant rock stack — the kind of spot you only find by wandering further than you planned to." },
  "img-091": { title: "The Bridge Over the Falls", location: "New Zealand", story: "A footbridge crossing directly over the lip of a bush waterfall — an unusual vantage that makes the falls feel almost incidental to the walk." },

  // ---------- Alpine & Lakes ----------
  "img-071": { title: "The Whale-Bone Bridge", location: "Te Rewa Rewa Bridge, New Plymouth, Taranaki, New Zealand", story: "Curved white ribs framing the mountain beyond — one of the more striking pieces of public architecture in the country, built to echo a wave and a whale's spine at once." },

  // ---------- Coast & Beaches ----------
  "img-084": { title: "Sky on Fire", location: "New Zealand coastline", story: "A sunrise that turns the whole sky the colour of embers, rocks and a lone pōhutukawa silhouetted against it." },
  "img-051": { title: "The Jetty Between Two Bays", location: "Coromandel, New Zealand", story: "A single jetty splitting two curved beaches, a small boat moored alongside — the kind of view that makes you want to just sit at the end of it." },
  "img-077": { title: "Grass, Rock, and a Falling Sun", location: "Auckland's west coast, New Zealand", story: "Windswept grass in the foreground, an offshore rock catching the day's last light — a coastline that always looks like it's in a mood." },
  "img-072": { title: "Sunset in the Cove", location: "New Zealand coastline", story: "A cove closed in on both sides by dark headlands, the sky doing all the work in gold and violet." },
  "img-073": { title: "Where the Cliffs Meet the Tide", location: "New Zealand coastline", story: "The same bay, the tide a little further in, rock stacks catching the last warm light before the colour goes out of the sky entirely." },
  "img-035": { title: "The Hidden Lagoon", location: "New Zealand coastline", story: "A pocket of impossibly clear water tucked behind a rocky headland — the sort of spot that only reveals itself once you've climbed over the hill to look." },
  "img-053": { title: "Layers of Light", location: "Auckland's west coast, New Zealand", story: "Cliffs stacked in warm gold, the coastline curving away into haze — golden hour doing exactly what it does best." },
  "img-043": { title: "Storm's Edge", location: "Auckland's west coast, New Zealand", story: "Heavy cloud breaking just enough to let the sun through in hard shafts of light over a wild, wind-whipped sea." },

  // ---------- Waterfalls ----------
  "img-080": { title: "The River's Fury", location: "Tongariro National Park, New Zealand", story: "White water churning over volcanic rock, a modest drop doing its best impression of something much bigger." },
  "img-027": { title: "Cascade Over the Dome", location: "Waikato, New Zealand", story: "Water fans out over a mossy rock dome in dozens of separate threads, tree ferns crowding in on every side." },
  "img-079": { title: "Veils of White", location: "Waikato, New Zealand", story: "The same cascade, pulled back a little wider — water falling like a curtain rather than a single stream." },
  "img-114": { title: "Nikau and Water", location: "Coromandel, New Zealand", story: "A tiered waterfall dropping into a turquoise pool, nikau palms leaning in as if they came just to watch." },
  "img-034": { title: "The Long Fall", location: "Waikato, New Zealand", story: "A single unbroken drop from a hanging cliff, the base lost in its own mist by the time the water gets there." },
  "img-021": { title: "Taranaki Falls in Winter", location: "Tongariro National Park, New Zealand", story: "The falls still running hard even with snow banked up along the pool's edge — proof that winter here is more bark than bite." },
  "img-082": { title: "The Colour of Huka", location: "Huka Falls, Taupō, New Zealand", story: "That impossible turquoise isn't a filter — it's just how much water the Waikato River is forcing through a gap this narrow." },
  "img-075": { title: "Green Cathedral", location: "New Zealand", story: "Moss thick enough to look upholstered, a narrow fall of water cutting straight through the middle of it." },
  "img-112": { title: "Wide and Wild", location: "New Zealand", story: "A broad curtain of falling water fanning into a dark, still pool — more volume than height, and all the more dramatic for it." },
  "img-018": { title: "The Falls, Standing Tall", location: "Taranaki Falls, Tongariro National Park, New Zealand", story: "The full drop in one vertical frame, snow still lingering at the base while the water keeps working." },
  "img-113": { title: "Framed by the Forest", location: "Coromandel, New Zealand", story: "An overhanging branch and a nikau palm doing the framing this time — the same falls, seen the way you'd actually stumble on them." },

  // ---------- Long Exposure ----------
  "img-039": { title: "Fire Written in the Air", location: "Fiji", story: "Spinning fire traced into a long exposure until it stops looking like poi and starts looking like something drawn by hand." },
  "img-040": { title: "Sparks and Motion", location: "Fiji", story: "A single frame holding several seconds of movement — fire flung, caught, and flung again." },
  "img-041": { title: "Rings of Flame", location: "Fiji", story: "Two overlapping circles of fire, traced so cleanly they could almost be a logo rather than a performance." },
  "img-118": { title: "Flight Paths", location: "New Zealand", story: "Dozens of takeoffs stacked into one exposure until the night sky looks strung with wire." },
  "img-117": { title: "Departures", location: "New Zealand", story: "Aircraft banking away from the runway, their trails curling back over the city they just left." },
  "img-119": { title: "Crossing in the Dark", location: "New Zealand", story: "A long, low bridge traced entirely in the tail-lights of everyone crossing it after dark." },
  "img-101": { title: "Night Traffic, Ancient Mountain", location: "Desert Road, Central Plateau, New Zealand", story: "Car lights streak past in red and gold while an eleven-thousand-year-old volcano looks on, entirely unmoved." },
  "img-120": { title: "Lion City Lights", location: "Singapore", story: "A skyline stacked with glass and neon, a bridge traced in gold, the water doing the rest of the work in reflection." },

  // ---------- Travel ----------
  "img-006": { title: "Quiet Corner of the Park", location: "Auckland, New Zealand", story: "Autumn leaves scattered across open grass, mature trees casting long afternoon shade — an ordinary park moment that's easy to walk straight past." },

  // ---------- Details & Nature ----------
  "img-088": { title: "Dahlias in Bloom", location: "New Zealand", story: "A tangle of yellow, orange and pink dahlias, the kind of close-up burst of colour that's a deliberate change of pace from wide-open landscapes." },
};

const images = loadImages();
let updated = 0;
for (const img of images) {
  const u = UPDATES[img.id];
  if (!u) continue;
  img.title = u.title;
  img.location = u.location;
  img.story = u.story;
  img.needsTitleReview = false;
  updated++;
}

saveImages(images);
const config = loadConfig();
publish(images, config);
console.log(`Updated ${updated} images (of ${Object.keys(UPDATES).length} in the map).`);

const stillGeneric = images.filter((i) => i.needsTitleReview);
console.log(`Remaining needing review: ${stillGeneric.length}`);
if (stillGeneric.length) console.log(stillGeneric.map((i) => i.id + " " + i.file).join("\n"));
