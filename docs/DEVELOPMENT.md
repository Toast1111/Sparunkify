# Development

## Checks and packaging

Node.js 22 or later is required. No runtime dependencies or build step are needed.

```sh
npm run check
npm test
npm run package
```

The package script uses an explicit allowlist to write the extension ZIP and SHA-256 checksum to `dist/`. Tests, source assets, documentation and recordings are excluded. GitHub Actions runs the checks and uploads the package as a workflow artifact.

## Browser verification

Install Playwright separately and provide its module path. The checks use isolated browser sessions.

```sh
node scripts/check-ui.cjs /path/to/node_modules/playwright
node scripts/check-theme.cjs /path/to/node_modules/playwright
node scripts/check-maxwell.cjs /path/to/node_modules/playwright
```

The Maxwell check uses installed Chrome for the preview and Playwright Chromium for an extension fixture. An optional second argument after the module path selects a Chromium executable. Generated screenshots and browser profiles go to the ignored `artifacts/` directory.

`python scripts/check-lighting.py` is an optional GPU regression check requiring ModernGL, NumPy and Pillow. It uses the historical renderer fixtures in `tests/fixtures/` to compare lighting behavior. Those fixtures are test inputs and are never packaged with the extension.

## Assets and recordings

The original Maxwell model and canonical textures live in `assets/maxwell/`. Regenerate the browser mesh using Python's standard library:

```sh
python scripts/convert-maxwell.py
```

See the [asset notes](../assets/maxwell/README.md) for file roles and provenance.

The README recording is `docs/media/maxwell.gif`. To optimize a replacement recording, install Pillow and run:

```sh
python scripts/optimize-readme-gif.py /path/to/original.gif
```

Keep original recordings and other local working files in `.local/`, which Git ignores. The optimizer preserves the original file and animation duration.

## Maxwell implementation

The popup must be invoked on the Spotify tab to grant `activeTab`. Enabling Maxwell starts tab-audio capture in an extension offscreen document. Web Audio analyses the stream locally and preserves audible playback. Samples are forwarded to the content script, which renders Maxwell in a separate layout slot below the artwork.

Audio amplitudes retain values above one. Hit strength follows recent energy and transient variation, with logarithmic compression. Body deformation eases through intermediate shapes and limits height to 55-120% of the normal loaf. Maxwell stays planted, and the camera stays fixed. Reduced-motion preferences keep him still. Turning Maxwell or the extension off releases capture.

## Release verification

Verify a signed-in Spotify session: change tracks, pause playback, compare **Original**, adjust settings, toggle Maxwell, close the artwork view, and reload the extension and tab. Confirm capture stops when Maxwell is disabled or the Spotify tab closes.

Automated checks cover controlled browser fixtures, not a signed-in Spotify account. Spotify DOM changes may require selector updates. The extension supports Spotify Web Player, not the native desktop app.
