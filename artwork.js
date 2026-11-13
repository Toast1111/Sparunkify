/* Match size variants by artwork identity, without matching unrelated covers. */
(() => {
  const sizes = { '4851': 64, '1e02': 300, 'b273': 640, '82c1': 2000 };
  function parse(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
      if (['lh3.googleusercontent.com','yt3.googleusercontent.com','yt3.ggpht.com'].includes(url.hostname)) {
        // Google image sizing suffixes change across the mini and full player.
        const pathname=url.pathname.replace(/=(?:w|s)\d+[^/]*$/,'');
        return {url,album:null,key:url.origin+pathname,size:Number(url.pathname.match(/=(?:w|s)(\d+)/)?.[1]||0)};
      }
      if (['i.ytimg.com','img.youtube.com'].includes(url.hostname)) {
        const video=url.pathname.match(/^\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]+)\/[^/]+\.(?:jpg|webp)$/);
        return video?{url,album:null,key:`youtube:${video[1]}`,size:0}:null;
      }
      if (!['i.scdn.co', 'mosaic.scdn.co'].includes(url.hostname)) return null;
      const album = url.hostname === 'i.scdn.co' && url.pathname.match(/^\/image\/ab67616d0000([a-f0-9]{4})([a-f0-9]{24})$/i);
      return {url, album, key: album ? `album:${album[2]}` : url.origin + url.pathname, size: album ? sizes[album[1]] || 0 : 0};
    } catch { return null; }
  }
  function key(value) { return parse(value)?.key || null; }
  function candidates(value) {
    const info = parse(value);
    if (!info) throw new Error('Unsupported artwork host.');
    // This CDN convention is not an API guarantee; retain the original URL as a fallback.
    if (!info.album || !sizes[info.album[1]]) return [info.url.href];
    const variant = code => `https://i.scdn.co/image/ab67616d0000${code}${info.album[2]}`;
    return [...new Set([variant('82c1'), variant('b273'), info.url.href])];
  }
  function bestSource(current, images) {
    const target = key(current); if (!target) return current;
    let best = current, score = parse(current).size;
    const consider = (url, width = 0) => {
      const info = parse(url);
      if (!info || info.key !== target) return;
      const rank = Math.max(width, info.size);
      if (rank > score) { best = info.url.href; score = rank; }
    };
    for (const image of images) {
      consider(image.currentSrc || image.src, image.naturalWidth || 0);
      consider(image.src);
      for (const item of (image.srcset || '').split(',')) {
        const [url, descriptor = ''] = item.trim().split(/\s+/);
        consider(url, descriptor.endsWith('w') ? parseFloat(descriptor) || 0 : 0);
      }
    }
    return best;
  }
  globalThis.SparunkifyArtwork = {parse, key, candidates, bestSource};
})();
