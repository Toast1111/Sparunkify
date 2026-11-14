# Chrome Web Store graphics

Ready-to-upload assets for Sparunkify. Screenshots and promotional tiles are RGB PNGs without transparency. The store icon retains its transparent rounded corners.

| Store field | File | Dimensions |
| --- | --- | --- |
| Store icon | [store-icon-128.png](store-icon-128.png) | 128 × 128 |
| Screenshot 1: artwork effects | [01-artwork-effects.png](01-artwork-effects.png) | 1280 × 800 |
| Screenshot 2: sidebar and Maxwell | [02-sidebar-maxwell.png](02-sidebar-maxwell.png) | 1280 × 800 |
| Screenshot 3: original/effects comparison | [03-original-vs-effects.png](03-original-vs-effects.png) | 1280 × 800 |
| Screenshot 4: interface only, finish controls | [04-finish-settings.png](04-finish-settings.png) | 1280 × 800 |
| Small promo tile | [small-promo-440x280.png](small-promo-440x280.png) | 440 × 280 |
| Optional marquee | [marquee-1400x560.png](marquee-1400x560.png) | 1400 × 560 |

Use the screenshots in the numbered order. The promo-video field can be left empty.

## Demonstration content

“Afterglow” by “Sparunkify Sessions” is a fictional demonstration album, not an actual recording or artist release. Its cover was generated specifically for this project with the built-in OpenAI imagegen tool. No existing album cover was supplied as a reference. The image itself and the promotional graphics identify it as demo artwork.

The graphics use captures of Sparunkify's actual artwork renderer and settings UI. Screenshot 4 is a direct capture of the image-preview interface with no promotional frame or added marketing text. The sidebar example runs the actual extension content scripts in a controlled layout fixture and is labeled as a layout demonstration. It is not a screenshot of a signed-in Spotify account. No user listening history, account details or third-party album covers are included.

The original/effects comparison uses the same source image in both panels. The existing **Gross vs. Great** GIFs in the main README are retained separately.

Maxwell is [bean(alwayshasbean)'s model](https://sketchfab.com/3d-models/maxwell-the-cat-dingus-2ca7f3c1957847d6a145fc35de9046b0), used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), adapted and animated for Sparunkify. See [third-party notices](../../THIRD_PARTY_NOTICES.md).

## Regenerate the graphics

Keep the [source cover](source/afterglow-cover.png), install Playwright separately, and run:

```sh
node scripts/build-store-assets.cjs /path/to/node_modules/playwright /path/to/chromium
```

Installed Chrome renders the local preview; the Chromium executable is used for an isolated extension fixture. Omit the executable argument to use Playwright's bundled Chromium. Temporary captures stay in ignored `artifacts/store/`; Playwright removes the isolated temporary browser profile when its context closes.

## Original image-generation prompt

Built-in imagegen mode; no image references; opaque background. Generated on November 12, 2026.

> Use case: ads-marketing. Asset type: original fictional album cover for demonstrating Sparunkify, an album-artwork effects extension. Create one exquisite square album cover, 2048 x 2048 requested, full bleed. Original abstract sculptural artwork: a single folded flowing ribbon of iridescent brushed metal floating in a deep charcoal studio, delicate cyan, magenta, violet and warm silver reflections with tangible microtexture, crisp high-contrast sculptural edges, velvety shadows, editorial art direction, quiet cinematic lighting, sophisticated and striking as a small thumbnail. Center the sculpture with comfortable margins. Place beautifully typeset exact title 'AFTERGLOW' in large bold elegant sans-serif near the lower left, with exact smaller text 'SPARUNKIFY SESSIONS' above the title, and the exact small footer text 'FICTIONAL ALBUM / DEMO ARTWORK'. Readable typography that belongs to the design. Invent all artwork from scratch; do not imitate or reference any existing album cover or artist, and include no real performers, record labels, platform logos, trademarks or photographic likenesses. Output only the finished square cover, no mockup, no vinyl sleeve, no browser or UI.
