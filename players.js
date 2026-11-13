/* Small player adapters; no account APIs, injected page scripts or API keys. */
(() => {
  'use strict';
  const players=[
    {id:'spotify',name:'Spotify',origin:'https://open.spotify.com'},
    {id:'youtube-music',name:'YouTube Music',origin:'https://music.youtube.com'}
  ];
  function player(value){try{const origin=new URL(value).origin;return players.find(item=>item.origin===origin)||null;}catch{return null;}}
  function artworkAllowed(value,source){
    try{
      const url=new URL(value),service=player(source);
      if(url.protocol!=='https:'||url.port||url.username||url.password||!service)return false;
      return service.id==='spotify'?['i.scdn.co','mosaic.scdn.co'].includes(url.hostname):
        ['lh3.googleusercontent.com','yt3.googleusercontent.com','yt3.ggpht.com','i.ytimg.com','img.youtube.com'].includes(url.hostname);
    }catch{return false;}
  }
  function readTrack(doc,source){
    const service=player(source);if(!service)return null;
    let bar,image,title,artist;
    if(service.id==='spotify'){
      bar=doc.querySelector('[data-testid="now-playing-widget"]')||doc.querySelector('footer [data-testid="nowplaying-track-link"]')?.closest('footer')||doc.querySelector('[data-testid="now-playing-bar"]');
      image=bar?.querySelector('img[data-testid="cover-art-image"]')||bar?.querySelector('img[src*="scdn.co"]');
      title=bar?.querySelector('[data-testid="context-item-info-title"], [data-testid="nowplaying-track-link"], a[href*="/track/"]')?.textContent?.trim();
      artist=[...bar?.querySelectorAll('[data-testid="context-item-info-artist"], a[href*="/artist/"]')||[]].map(node=>node.textContent.trim()).filter(Boolean);
      artist=[...new Set(artist)].join(', ');
    }else{
      // YouTube Music's modern player uses track-info components in place of
      // the legacy player bar, including hidden/empty responsive copies.
      const bars=[...doc.querySelectorAll('ytmusic-track-info, ytmusic-player-bar')];
      bars.sort((a,b)=>Number(b.getClientRects().length>0)-Number(a.getClientRects().length>0));
      for(bar of bars){
        title=bar.querySelector('.ytmusicTrackInfoTitle, .title')?.textContent?.trim();
        image=[...bar.querySelectorAll('img')].find(img=>artworkAllowed(img.currentSrc||img.src,source));
        if(!title||!image)continue;
        const byline=bar.querySelector('.ytmusicTrackInfoByline, .byline');
        artist=byline?.querySelector('a[href*="/channel/"]')?.textContent?.trim()||byline?.querySelector('a')?.textContent?.trim()||byline?.textContent?.trim().split(/\s*[•·]\s*/)[0];
        break;
      }
      if(!title||!image)return null;
    }
    if(!image)return null;
    const url=image.currentSrc||image.src;
    if(!artworkAllowed(url,source))return null;
    return {url:globalThis.SparunkifyArtwork.bestSource(url,doc.querySelectorAll('img')),title:title||image.alt||'Now playing',artist:artist||service.name,image};
  }
  function artworkImages(doc,source){
    return player(source)?.id==='youtube-music'?doc.querySelectorAll('ytmusic-player img'):doc.querySelectorAll('img');
  }
  function playbackButton(doc,action){
    const names={previous:['Previous'],next:['Next'],toggle:['Pause','Play']}[action]||[];
    for(const scope of doc.querySelectorAll('[aria-label="PLAYBACK_CONTROLS"], ytmusic-player-bar, #music-player-wrapper, ytmusic-player-page')){
      for(const name of names){const button=[...scope.querySelectorAll(`button[aria-label="${name}"], [role="button"][aria-label="${name}"]`)].find(node=>node.getClientRects().length>0);if(button)return button;}
      const legacy=scope.querySelector({previous:'.previous-button',next:'.next-button',toggle:'#play-pause-button, .play-pause-button'}[action]);
      if(legacy&&legacy.getClientRects().length>0)return legacy;
    }
    return null;
  }
  function playback(doc){
    const media=()=>{const videos=[...doc.querySelectorAll('video.html5-main-video, ytmusic-player video, ytmusic-player audio')];return videos.find(video=>!video.paused&&Number.isFinite(video.duration))||videos.find(video=>Number.isFinite(video.duration)&&video.duration>0)||videos[0];};
    return {
      state(){const video=media();return {paused:video?.paused??true,currentTime:video?.currentTime||0,duration:Number.isFinite(video?.duration)?video.duration:0,previous:!!playbackButton(doc,'previous'),next:!!playbackButton(doc,'next'),available:!!video||!!playbackButton(doc,'toggle')};},
      async action(action){const video=media();if(action==='toggle'&&video){if(video.paused)await video.play();else video.pause();return;}const button=playbackButton(doc,action);if(button)button.click();},
      seek(time){const video=media();if(video&&Number.isFinite(time)&&Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(0,Math.min(video.duration,time));}
    };
  }
  function bottomInset(doc,viewportHeight){
    let inset=0;
    for(const controls of doc.querySelectorAll('ytmusic-player-bar, [aria-label="PLAYBACK_CONTROLS"], [data-testid="now-playing-bar"]')){
      for(let node=controls,depth=0;node&&node!==doc.body&&depth<6;node=node.parentElement,depth++){
        const rect=node.getBoundingClientRect();
        if(rect.width>300&&rect.height>=40&&rect.height<=180&&Math.abs(rect.bottom-viewportHeight)<8)inset=Math.max(inset,rect.height);
      }
    }
    return inset;
  }
  const overlaySelector='[role="menu"], [role="dialog"], [aria-modal="true"], tp-yt-iron-dropdown, tp-yt-paper-dialog, ytmusic-menu-popup-renderer, ytmusic-multi-page-menu-renderer';
  function hasOpenOverlay(doc){
    return [...doc.querySelectorAll(overlaySelector)].some(node=>{
      // The native media player itself can be marked as a dialog in video mode.
      if(node.matches('ytmusic-player, ytmusic-player-page, ytmusic-app, [id^="sparunkify-"]')||node.closest('[hidden], [aria-hidden="true"]'))return false;
      const rect=node.getBoundingClientRect(),style=doc.defaultView.getComputedStyle(node);
      return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<doc.defaultView.innerHeight&&rect.left<doc.defaultView.innerWidth&&style.visibility!=='hidden'&&style.display!=='none'&&Number(style.opacity)!==0;
    });
  }
  globalThis.SparunkifyPlayers={players,patterns:players.map(item=>item.origin+'/*'),player,artworkAllowed,readTrack,artworkImages,playback,bottomInset,overlaySelector,hasOpenOverlay};
})();
