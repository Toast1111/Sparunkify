/* Fetch only Spotify artwork. No cookies, credentials, arbitrary URLs or page scripts. */
importScripts('artwork.js');
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type !== 'artwork') return;
  if (!sender.tab?.url?.startsWith('https://open.spotify.com/')) {
    reply({error: 'This request must come from Spotify.'}); return;
  }
  (async () => {
    const url = new URL(message.url);
    if (url.protocol !== 'https:' || !['i.scdn.co', 'mosaic.scdn.co'].includes(url.hostname)) {
      throw new Error('Unsupported artwork host.');
    }
    let failure;
    for (const candidate of SparunkifyArtwork.candidates(url.href)) {
      try {
        const response = await fetch(candidate, {credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000)});
        if (!response.ok) throw new Error(`Artwork request failed (${response.status}).`);
        const type = response.headers.get('content-type') || '';
        if (!/^image\/(jpeg|png|webp)(;|$)/i.test(type)) throw new Error('Unsupported artwork format.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 8 * 1024 * 1024) throw new Error('Artwork is too large.');
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return {data: `data:${type.split(';')[0]};base64,${btoa(binary)}`, url: candidate};
      } catch (error) { failure = error; }
    }
    throw failure;
  })().then(reply, error => reply({error: error.message}));
  return true;
});
