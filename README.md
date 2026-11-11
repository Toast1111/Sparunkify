# Sparunkify

Album artwork with soft reflections, subtle relief and cursor tilt. A small Chrome extension for Spotify Web Player.

| Yucky before | Delicious after |
| --- | --- |
| ![Early spotlight and washed colors](docs/media/before.gif) | ![Soft reflections and preserved contrast](docs/media/after.gif) |

Same original demo artwork, settings and cursor path. Actual old renderer vs. current renderer; offline demos, not Spotify footage.

## Install

1. Download the extension ZIP from **Releases** and extract it, or clone this repo.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Refresh Spotify Web Player, play a track, and click **Artwork**.

Use **Original** to compare and **Settings** to adjust the finish. **Escape** closes the view. After updating, reload the extension and refresh Spotify.

No API keys, runtime dependencies or analytics. Settings stay local. [Privacy](PRIVACY.md).

Chrome Web Player only. Spotify background matching depends on the page layout; otherwise an artwork color is used. Not affiliated with Spotify.

## Development

```sh
npm run check
npm test
npm run package
```

[Visual checks and release notes](docs/DEVELOPMENT.md). License has not been selected; this repository is private for now.
