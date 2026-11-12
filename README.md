# Sparunkify

A Chrome extension that brings reflective album artwork and an optional audio-reactive Maxwell cat directly to Spotify Web Player's sidebar.

![Sparunkify artwork effects and Maxwell demo](docs/media/maxwell.gif)

## Features

- Foil, gloss and embossed artwork finishes with adjustable relief and reflections.
- Artwork effects in the Web Player's Now Playing sidebar, plus an expanded artwork view with pointer tilt.
- Optional Maxwell below the sidebar artwork and above the track details, with music-driven spin and squish.
- Local settings and audio processing. No account API keys or analytics.

## Built into the Web Player sidebar

Keep browsing Spotify while Sparunkify adds reflections and depth to the large album cover in the **Now Playing sidebar**. Maxwell has his own space below the cover, with the song title and artist visible underneath.

1. Play a track and open the Web Player's Now Playing sidebar so the large cover is visible.
2. Open the Sparunkify extension popup and enable **Show effects in Spotify**.
3. Optionally enable **Maxwell below artwork** from that same Spotify tab. He spins and squishes to the music while staying below the cover.

The separate **Artwork** view is also available for a larger preview and finish adjustments.

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

Turning **Maxwell below artwork** off releases tab-audio capture.

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
