# Development

## Checks and packaging

Node.js 22 or later is required. No runtime dependencies or build step are needed.

```sh
npm run check
npm test
npm run package
```

The package script uses an explicit allowlist to write the extension ZIP and SHA-256 checksum to `dist/`. It includes privacy information and third-party attribution. Tests, source assets, development documentation and recordings are excluded. GitHub Actions runs the checks and uploads the package as a workflow artifact.

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

The **Gross vs. Great** comparison uses `docs/media/before.gif` and `docs/media/after.gif`. To regenerate them from the historical and current renderers, use Playwright and Pillow:

```sh
node scripts/render-demos.cjs /path/to/node_modules/playwright
python scripts/make-demo-gifs.py
```

Keep original recordings and other local working files in `.local/`, which Git ignores. The optimizer preserves the original file and animation duration.

Upload-ready store screenshots and promotional tiles use original fictional album art. See [Chrome Web Store graphics](store/README.md) for the files, dimensions, source prompt and regeneration instructions.

## Maxwell implementation

The popup must be invoked on the Spotify tab to grant `activeTab`. Enabling Maxwell starts tab-audio capture in an extension offscreen document. Web Audio analyses the stream locally and preserves audible playback. Samples are forwarded to the content script, which renders Maxwell in a separate layout slot below the artwork.

Audio amplitudes retain values above one. Bass (35-180 Hz) and waveform RMS are independently calibrated against their own smoothed amplitude references before the 80/20 blend. References rise over 1.5 seconds and fall over 20 seconds, hold through silence, and have minimum levels of 0.08 for bass and 0.12 for RMS in the analyser's scaled units. This preserves quiet passages instead of continuously normalizing them to full strength.

Hit detection compares 15 ms and 150 ms energy followers. A hit must cross the onset threshold and rearm below a lower threshold before firing again. There is no timed cooldown: distinct close-together onsets can each add spin, while a held attack cannot keep triggering itself. Strength follows recent energy and transient variation with logarithmic compression and quiet-input attenuation.

Rotation combines a gentle idle speed of 0.35 rad/s, twice the sustained groove envelope, and additive hit impulses. The groove follows the normalized 80/20 energy blend with an 80 ms attack and 1.5 second release, carrying momentum between beats and gradually returning to idle in silence. Hits bypass the groove and retain their immediate attack and exponential decay of `exp(-7 * dt)` (about a 143 ms time constant), so the longer groove release does not increase impulse accumulation. There is no additional smoothing of the combined speed and no rotational speed cap. Beat-driven squish and rebound remain independent of the rotation envelope; there is no vertical bounce.

The quiet-to-loud regression holds bass/RMS at 0.008/0.006 for 30 seconds, then steps both amplitudes up 100-fold. With references at their floors, drive initially reaches 9.0, falls to about 1.48 after 1.5 seconds and 1.05 after 4.5 seconds, and produces one onset. A prior loud section leaves higher references and a smaller initial peak. This is an intentional measured transient, not a guarantee of mild rotation; use listening tests to judge its visual strength.

Body deformation eases through intermediate shapes and limits height to 55-120% of the normal loaf. Maxwell stays planted, and the camera stays fixed. Reduced-motion preferences keep him still. Turning Maxwell or the extension off releases capture.

## Release verification

Verify a signed-in Spotify session: change tracks, pause playback, compare **Original**, adjust settings, toggle Maxwell, close the artwork view, and reload the extension and tab. Confirm capture stops when Maxwell is disabled or the Spotify tab closes.

Automated checks cover controlled browser fixtures, not a signed-in Spotify account. Spotify DOM changes may require selector updates. The extension supports Spotify Web Player, not the native desktop app.
