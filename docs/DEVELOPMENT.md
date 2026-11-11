# Development

No runtime dependencies or build step. Node 22+ runs the checks:

```sh
npm run check
npm test
npm run package
```

The ZIP in `dist/` contains only extension files and privacy information. CI runs these checks and uploads the ZIP as an artifact.

## Optional visual checks

Install Playwright separately, with Chrome available, then pass its module path:

```sh
node scripts/check-ui.cjs /path/to/node_modules/playwright
node scripts/check-theme.cjs /path/to/node_modules/playwright
node scripts/render-demos.cjs /path/to/node_modules/playwright
python scripts/make-demo-gifs.py
```

The GIF encoder needs Pillow. `scripts/check-lighting.py` additionally needs ModernGL and NumPy; it compares production GLSL with historical fixtures. Those fixtures are never loaded by the extension. Generated QA files stay in the ignored `artifacts/` folder.

## Release check

Verify a signed-in Spotify session: change albums, compare Original, adjust settings, close the view, and reload the extension/tab. Automated checks cover the renderer and browser fixtures, not a live Spotify account. Spotify DOM changes may require selector updates.

Backgrounds copy Spotify's visible matching artwork theme where available; otherwise the extension estimates a color. The extension is independent of Spotify and does not support the native desktop app.
