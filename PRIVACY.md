# Privacy

Sparunkify reads the current track title, artist and artwork URL from Spotify Web Player or YouTube Music to display artwork effects. Spotify background styles are also read to match its artwork view.

- Settings are saved locally with `chrome.storage.local`.
- Artwork is fetched directly from the player's image hosts, without cookies or credentials: `i.scdn.co` and `mosaic.scdn.co` for Spotify; `lh3.googleusercontent.com`, `yt3.googleusercontent.com`, `yt3.ggpht.com`, `i.ytimg.com` and `img.youtube.com` for YouTube Music.
- Images selected in the preview stay on your device.
- Pointer position is used locally for artwork tilt, and page scroll events keep inline artwork aligned. These interactions are not logged, retained as an activity history, or uploaded.
- The YouTube Music artwork view reads playback position, duration and paused state to display its controls. Play/pause and seeking act on the tab's media element; track navigation activates YouTube Music's existing player controls. This happens locally in response to your actions and is not logged or uploaded.
- Enabling Maxwell in the popup captures audio from the selected Spotify or YouTube Music tab. An extension offscreen document analyses it locally with Web Audio and preserves audible playback. Turning Maxwell or the extension off releases the capture. Audio is never recorded, stored or uploaded, and your microphone is not accessed.
- No analytics, tracking, remote code, account tokens or external processing servers.

The extension's page integration runs only on `open.spotify.com` and `music.youtube.com`; its image preview runs in a separate extension tab. Playback controls in the YouTube Music artwork view act on that same tab. Your selected player and its artwork hosts receive normal requests needed to load their content.
