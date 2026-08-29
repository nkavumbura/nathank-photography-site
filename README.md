# Portfolio site

A static site generated from the photos in the parent `Portfolio` folder.
Nothing in that folder is ever modified or deleted — this tool only reads
the originals and writes resized, watermarked copies into `site/dist/`.

## Editing the site (the easy way)

```bash
cd site
npm run admin     # editor at http://localhost:4321
npm run serve      # live site preview at http://localhost:8080 (open separately)
```

Run both, keep both terminal windows open while you work. The admin editor
has three tabs: **Galleries** (the drag-and-drop board), **Home Page**, and
**About Page**.

### Galleries tab

- **Reorder** photos by dragging within a column.
- **Move a photo to a different gallery** by dragging it into another
  column.
- **Hide a photo from the site** by dragging it onto the **Archived**
  column on the right — nothing is deleted from disk, and it can be
  dragged back into a gallery any time.
- **Add photos**: drag files from Finder onto the page (drop on a specific
  gallery column to add them there), or use the "+ Add photos" button.
- **Create a gallery**: "+ New gallery". Rename one by clicking its title.
  Reorder galleries with the ◀ ▶ arrows next to the count. Delete an empty
  one with the × button.
- **Click any card** to open the editor: title, location, story, per-photo
  Etsy link, and every camera/EXIF field (clear a field to remove it from
  the site — the story page only shows fields that have a value).

### Home Page tab

- **Site logo**: upload an image and it's automatically cut out onto a
  transparent background (bright pixels kept, dark background dropped) so
  it sits cleanly next to your site name in the header on every page,
  whatever shade of dark you picked for the artwork itself. Works best with
  a logo on a black/dark background; "Remove" reverts to text-only.
- **Choose banner photo**: click any thumbnail in the picker grid.
- **Reposition it**: drag the slider under the preview to choose which
  horizontal slice of the photo stays in frame once the browser crops it
  to fit the screen (panoramas are much wider than the banner area, so this
  matters a lot more than it would for a normal photo).
- **Custom headline**: overrides the photo's own title on the homepage
  only. Leave blank to just use the photo's title.
- **Tagline**: the line under the headline, also used as the meta
  description.

### About Page tab

- **Upload your photo**: click the button, pick an image. It's center-cropped
  to a circle at a modest size — not watermarked, since it's not for sale.
  The original you upload is kept in `site/uploads/` in case you want it
  back; only the processed copy goes in `dist/`.
- **About text**: separate paragraphs with a blank line.
- **Contact email**: shown as a mailto link at the bottom of the page.

Every change on every tab writes straight to the data files below and
republishes `dist/` immediately (resizing/watermarking runs only for
genuinely new photos, so most edits are instant). Refresh the live preview
tab to see it.

The admin tool (`site/admin/`) only runs on your own machine — it's never
part of the deployed site.

## What's here

```
site/
  config.json           <- your name, site name, watermark text, Etsy URL,
                            plus home.* (banner photo/position/headline) and
                            about.* (photo, body text) - all admin-editable
  uploads/                <- originals of anything uploaded through the
                            admin tool that isn't a portfolio photo (About
                            portrait, site logo)
  data/images.json       <- one entry per PUBLISHED photo: title, category,
                            location, story, camera EXIF, Etsy link, and
                            sortIndex (display order). Hand-edit is fine too
                            — rebuilding never overwrites text you've filled
                            in (see "Editing by hand" below)
  data/categories.json   <- the galleries: [{ key, label }, ...] in display
                            order. The admin tool manages this for you.
  data/archived.json      <- hidden/unpublished photos (auto-curated
                            non-panoramas, or anything you archived by hand)
                            - kept for reference, not deleted, not published
  data/excluded-duplicates.json  <- files skipped as duplicate size/edit
                            variants of another image (nothing was deleted)
  scripts/                <- the build pipeline + admin server (Node)
  admin/                  <- the local editor's UI (not deployed)
  dist/                   <- the actual website — point your host at this
                            folder. Everything in it is generated; don't
                            hand-edit files under dist/assets or dist/photo.
```

## The site only shows stitched panoramas (by default)

New photos are curated to panoramic-format only: anything where the long
side is at least 2x the short side (the standard photography definition of
"panoramic" — this also turned out to be a reliable signal for "genuinely
stitched," since several unmarked files landed on exact 3:1 / 2.5:1 ratios
no camera sensor produces natively, and it catches tall stitched vertoramas
too, not just wide ones).

This is only the *default* now — anything you explicitly add, restore, or
archive via the admin tool overrides it permanently (that choice is saved
per-photo and survives a full rescan). Dragging a photo out of Archived
publishes it regardless of its aspect ratio; dragging one into Archived
hides it even if it's a "true" panorama.

To change the default cutoff for brand-new photos, edit
`PANO_RATIO_THRESHOLD` in `scripts/build-manifest.mjs` (currently `2.0`).

## Each photo has its own story page

Every photo gets a dedicated page at `dist/photo/<id>.html` — inline
pan/zoom hero, category, location, a narrative "story" paragraph, an EXIF
table (camera, lens, focal length, aperture, shutter, ISO, date, and GPS
coordinates linked to Google Maps when present), an Etsy CTA, and prev/next
links — modeled on how vastphotos.com and kenduncan.com present a print.
The gallery grid still opens a quick in-place zoom lightbox (click the
magnifying-glass icon on a thumbnail); clicking the photo itself goes to
its story page.

## Editing by hand (instead of, or alongside, the admin tool)

Open `data/images.json`. Each image looks like:

```json
{
  "id": "img-042",
  "file": "Karekare Falls Panorama.jpg",
  "title": "Karekare Falls",
  "location": "Karekare, Waitākere Ranges, Auckland, New Zealand",
  "story": "",
  "etsyUrl": "",
  "sortIndex": 41
}
```

- `title`, `location`, `story`, `etsyUrl`, `category`/`categoryLabel`,
  `sortIndex` are all yours to edit directly.
- About half the images had no usable name in the original filename (camera
  codes like `1Q5A1234-HDR-Pano-Edit.jpg`), so they got a placeholder title
  like "Panorama 037" — search `images.json` for `"needsTitleReview": true`
  to find and rename them.
- `etsyUrl` on an individual image overrides the site-wide `etsyShopUrl` in
  `config.json`. Leave both blank and the site shows "Shop coming soon"
  instead of a dead link.
- After hand-editing `images.json` (text fields, order, or category — no
  new/removed photos), publish with: `npm run sync-data && npm run
  build:pages`. If you add or remove source photos on disk instead, run
  `npm run build` to rescan.

Re-running `npm run build:manifest` re-scans the source folder — it
preserves every hand-edited field by matching on filename, so it's always
safe to re-run even if you've been using the admin tool.

## Site-wide settings (`config.json`)

```json
{
  "siteName": "NathanK Photography",
  "photographerName": "Nathan Kavumbura",
  "tagline": "Panoramic landscape photography",
  "watermarkText": "© Nathan Kavumbura",
  "etsyShopUrl": "",
  "contactEmail": "..."
}
```

Change `photographerName` or `watermarkText`, then run `npm run build` to
bake the new watermark into every image (this reprocesses all photos, ~1-2
minutes). Set `etsyShopUrl` once your shop exists and every image's "Shop
coming soon" button turns into a live link automatically.

## Rebuilding from scratch

```bash
cd site
npm run build     # manifest -> sync -> resize/watermark -> story pages
npm run serve      # serves dist/ at http://localhost:8080 for local preview
```

Individual steps, if you only need one:
`npm run build:manifest` · `npm run sync-data` · `npm run build:images` ·
`npm run build:pages` · `npm run admin`

## How image protection works (and its real limits)

- The site never serves original files. Every photo shown on the web is a
  resolution-capped copy (long edge ~4200px, ~5600px for panoramas — your
  originals run 3900-11,600px, median ~6900px, so this is roughly 60-90%
  of native size for a typical shot and genuinely sharp when zoomed, while
  staying well short of print-resolution originals) with a
  visible watermark baked into the pixels — both set in `config.json`.
- Both the quick-zoom lightbox and each story page's hero draw to a
  `<canvas>`, not a plain `<img>`, and right-click / drag / Ctrl+S / Ctrl+P
  / DevTools shortcuts are disabled site-wide (`js/protections.js`).
- **Be aware:** no website can block an OS-level screenshot (Cmd+Shift+4,
  Snipping Tool, or literally a phone camera pointed at the screen). These
  measures raise the bar and guarantee any copy is capped-resolution and
  watermarked — that's the same standard used by Smugmug, 500px, Adobe
  Portfolio, etc. If you need stronger protection later, the natural next
  step is a deep-zoom tile viewer (e.g. OpenSeadragon + DZI tiles) so no
  single request ever contains the whole image — happy to add that if the
  current approach isn't enough once the site is live.

## Hosting recommendation

The whole site is static (`site/dist/`) — no server, database, or API
required, which keeps hosting essentially free. The admin editor
(`npm run admin`) is a separate local-only tool and is never deployed.

**Cloudflare Pages** (recommended): free tier, no bandwidth cap, fast global
CDN, trivial custom domain setup.
1. Push `site/dist` (or the whole repo) to a GitHub repo.
2. In the Cloudflare dashboard: Workers & Pages → Create → Pages → connect
   the repo → set build output directory to `site/dist` (no build command
   needed since `dist/` is already built).
3. Point your domain's DNS at Cloudflare when ready.

Netlify's free tier is an equally good alternative (100GB/month bandwidth,
same drag-and-drop-or-git workflow) if you'd rather use that.

Current `dist/` size is about 185MB (107 published photos at the
higher-resolution cap) — still comfortably within Cloudflare Pages' free
tier (no bandwidth cap; 25MB per-file limit, and our biggest files are
~3-4MB).

If you ever want even sharper zoom with stronger protection at the same
time, the next step up is tile-based deep zoom (like Google Maps — the
browser only ever fetches small tiles for what's on screen, so full
original resolution becomes safe to use as the source). We didn't do that
here because it generates tens of thousands of small files, which risks
Cloudflare Pages' free-tier file-count limit and needs more build tooling
(OpenSeadragon + DZI tiles) - worth it only if the current level of detail
ever feels insufficient.
