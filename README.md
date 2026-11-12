# Sparunkify

A Chrome extension for Spotify Web Player with reflective album artwork and an optional audio-reactive Maxwell cat.

![Sparunkify artwork effects and Maxwell demo](docs/media/maxwell.gif)

## Features

- Foil, gloss and embossed artwork finishes with adjustable relief and reflections.
- Pointer tilt, inline artwork effects and an expanded artwork view.
- Optional Maxwell below the artwork, with music-driven spin and squish.
- Local settings and audio processing. No account API keys or analytics.

## Gross vs. Great

| Gross | Great |
| --- | --- |
| ![Earlier renderer with washed colors](docs/media/before.gif) | ![Updated renderer with soft reflections and preserved contrast](docs/media/after.gif) |

Same demo artwork, settings and cursor path. Earlier renderer compared with the updated finish; recorded offline.

## Install

Requires Chrome 116 or later and Spotify Web Player.

1. Download and extract the extension ZIP from [Releases](https://github.com/Toast1111/Sparunkify/releases), or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Refresh Spotify Web Player, play a track, and select **Artwork**.

Use **Original** to compare the artwork, **Settings** to adjust its finish, and **Escape** to close the view. After an update, reload the extension and refresh Spotify.

To enable Maxwell, open the extension popup **on the playing Spotify tab** and turn on **Maxwell below artwork**. He stays below the artwork while music controls his spin and bounded squish. Turning him off releases tab-audio capture.

## Privacy and compatibility

Settings and audio processing stay on your device. See [Privacy](PRIVACY.md).

Supports Spotify Web Player in Chrome. Background matching depends on Spotify's page layout, with an artwork-color fallback. The native Spotify desktop app is not supported. Not affiliated with Spotify.

## Development

Node.js 22 or later; no runtime dependencies or build step.

```sh
npm run check
npm test
npm run package
```

The extension ZIP is written to `dist/`. See the [development guide](docs/DEVELOPMENT.md) for browser checks, asset generation and release verification.

## Licensing

A project license has not been selected. Model attribution and licensing notes are documented with the [Maxwell assets](assets/maxwell/README.md).
