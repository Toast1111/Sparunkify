# Privacy

Sparunkify reads the current track title, artist, artwork URL and background styles from Spotify Web Player to display the artwork view.

- Settings are saved locally with `chrome.storage.local`.
- Artwork is fetched directly from `i.scdn.co` or `mosaic.scdn.co`, without cookies or credentials.
- Images selected in the preview stay on your device.
- Pointer position is used locally for artwork tilt, and page scroll events keep inline artwork aligned. These interactions are not logged, retained as an activity history, or uploaded.
- Enabling Maxwell in the popup captures audio from the selected Spotify tab. An extension offscreen document analyses it locally with Web Audio and preserves audible playback. Turning Maxwell or the extension off releases the capture. Audio is never recorded, stored or uploaded, and your microphone is not accessed.
- No analytics, tracking, remote code, account tokens or external processing servers.

The extension's page integration runs only on `open.spotify.com`; its image preview runs in a separate extension tab. It does not control Spotify playback. Spotify and its artwork hosts receive normal requests needed to load their content.
