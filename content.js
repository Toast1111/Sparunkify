(() => {
  'use strict';
  const S=globalThis.Sparunkify;
  if(document.getElementById('sparunkify-launcher'))return;
  let settings={...S.defaults},track=null,art=null,artURL='',pendingURL='',generation=0,surface=null,inline=null,scanTimer=null,saveTimer=null,lastFailed='',failedAt=0,contextStale=false,pageClosed=false;
  const launcher=document.createElement('div');launcher.id='sparunkify-launcher';const shadow=launcher.attachShadow({mode:'open'});
  shadow.innerHTML='<style>:host{all:initial;position:fixed;bottom:108px;right:24px;z-index:2147483500}button{font:13px Arial,sans-serif;color:#eee;background:#252525;border:1px solid #555;border-radius:5px;padding:10px 14px;cursor:pointer}button:hover{background:#333}button:focus-visible{outline:2px solid #ddd;outline-offset:3px}</style><button title="Open Sparunkify artwork view">Artwork</button>';
  document.body.append(launcher);shadow.querySelector('button').addEventListener('click',open);
  function hasContext(){try{return Boolean(chrome.runtime?.id);}catch{return false;}}
  function markContextStale(){
    if(contextStale||pageClosed)return;
    contextStale=true;generation++;pendingURL='';
    clearTimeout(saveTimer);clearTimeout(scanTimer);saveTimer=scanTimer=null;
    clearInterval(timer);observer.disconnect();destroyInline();
    const button=shadow.querySelector('button');button.textContent='Refresh Spotify';
    button.title='The extension was reloaded. Refresh this tab to reconnect.';
    launcher.hidden=!!surface;
    surface?.setStatus('Sparunkify was reloaded. Refresh this Spotify tab to reconnect; recent settings may not have saved.');
  }
  function handleExtensionError(error,message){
    if(pageClosed)return;
    if(!hasContext()||/extension context invalidated/i.test(error?.message||String(error))){markContextStale();return;}
    surface?.setStatus(message);
  }
  function save(next){
    settings=S.normalize(next);if(inline)inline.renderer.settings=settings;
    clearTimeout(saveTimer);
    if(contextStale||pageClosed)return;
    saveTimer=setTimeout(async()=>{
      saveTimer=null;
      if(pageClosed||contextStale)return;
      try{
        if(!hasContext()){markContextStale();return;}
        // An invalidated extension may throw synchronously before returning a Promise.
        await chrome.storage.local.set({settings});
      }catch(error){handleExtensionError(error,'Could not save settings. Your changes apply to this view; try adjusting the setting again.');}
    },180);
  }
  function close(){surface?.destroy();surface=null;launcher.hidden=!settings.enabled;shadow.querySelector('button').focus();schedule();}
  function open(){if(contextStale){location.reload();return;}if(!hasContext()){markContextStale();return;}if(!settings.enabled){save({...settings,enabled:true});}if(surface)return;destroyInline();surface=S.createSurface({settings,onSettings:save,onClose:close});launcher.hidden=true;if(track)surface.setTrack(track);if(art)surface.setImage(art);updateTheme();surface.root.querySelector('#close').focus();schedule();}
  function readTrack(){
    // Narrow to the playback bar; don't mistake playlist thumbnails for the playing album.
    const bar=document.querySelector('[data-testid="now-playing-widget"]') || document.querySelector('footer [data-testid="nowplaying-track-link"]')?.closest('footer') || document.querySelector('[data-testid="now-playing-bar"]');
    if(!bar)return null;
    const image=bar.querySelector('img[data-testid="cover-art-image"]')||bar.querySelector('img[src*="scdn.co"]');
    if(!image)return null;
    const url=image.currentSrc||image.src;if(!/^https:\/\/(i|mosaic)\.scdn\.co\//.test(url))return null;
    const title=bar.querySelector('[data-testid="context-item-info-title"], [data-testid="nowplaying-track-link"], a[href*="/track/"]')?.textContent?.trim()||image.alt||'Now playing';
    const artists=[...bar.querySelectorAll('[data-testid="context-item-info-artist"], a[href*="/artist/"]')].map(node=>node.textContent.trim()).filter(Boolean);
    return {url:SparunkifyArtwork.bestSource(url,document.querySelectorAll('img')),title,artist:[...new Set(artists)].join(', ')||'Spotify',image};
  }
  function artKey(url){return SparunkifyArtwork.key(url);}
  async function fetchArt(next){
    if(contextStale||pageClosed)return;
    if(next.url===artURL||next.url===pendingURL)return;
    if(next.url===lastFailed&&Date.now()-failedAt<15000)return;
    const token=++generation;pendingURL=next.url;
    try{
      surface?.setStatus('Preparing light, depth and surface maps…');
      const response=await chrome.runtime.sendMessage({type:'artwork',url:next.url});
      if(response?.error)throw new Error(response.error);if(!response?.data)throw new Error('Reload Spotify after reloading the extension.');
      const image=new Image();image.src=response.data;await image.decode();if(token!==generation)return;
      art=image;artURL=next.url;lastFailed='';destroyInline();surface?.setImage(image);schedule();
    }catch(error){if(token!==generation)return;lastFailed=next.url;failedAt=Date.now();handleExtensionError(error,error.message);}
    finally{if(token===generation)pendingURL='';}
  }
  function destroyInline(){if(!inline)return;inline.renderer.destroy();inline.host.remove();inline=null;}
  function updateInline(){
    if(!settings.enabled||!settings.inline||surface||!art||!track||artKey(artURL)!==artKey(track.url)){destroyInline();return;}
    const candidate=[...document.querySelectorAll('img')].filter(img=>artKey(img.currentSrc||img.src)===artKey(track.url)).map(img=>({img,rect:img.getBoundingClientRect()})).filter(({rect})=>rect.width>=170&&rect.height>=170&&Math.abs(rect.width-rect.height)<20&&rect.bottom>0&&rect.top<innerHeight-90).sort((a,b)=>b.rect.width-a.rect.width)[0];
    if(!candidate){destroyInline();return;}
    if(inline?.image!==candidate.img){
      destroyInline();const host=document.createElement('div');host.style.cssText='position:fixed;pointer-events:none;z-index:100;border-radius:8px;overflow:hidden;';host.id='sparunkify-inline';const root=host.attachShadow({mode:'open'}),canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block';root.append(canvas);document.body.append(host);
      try{const renderer=new S.Renderer(canvas,settings,()=>destroyInline());renderer.setImage(art);inline={host,renderer,image:candidate.img};}catch{host.remove();return;}
    }
    const r=candidate.rect;Object.assign(inline.host.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',borderRadius:getComputedStyle(candidate.img).borderRadius});
    const top=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-91,r.top+r.height/2)));
    inline.host.style.visibility=top&&(top===candidate.img||top.contains(candidate.img)||candidate.img.parentElement?.contains(top))?'visible':'hidden';inline.renderer.active=inline.host.style.visibility==='visible';
  }
  function updateTheme(){if(surface)surface.setTheme?.(track&&S.readSpotifyTheme?S.readSpotifyTheme(track.url):null);}
  function scan(){scanTimer=null;if(contextStale||pageClosed||!settings.enabled)return;if(!hasContext()){markContextStale();return;}const next=readTrack();if(next){track=next;surface?.setTrack(next);void fetchArt(next);}else{track=null;surface?.setStatus('No current track detected. Start a track in Spotify Web Player.');}updateTheme();updateInline();}
  function schedule(){if(!contextStale&&!pageClosed&&!scanTimer)scanTimer=setTimeout(scan,300);}
  const observer=new MutationObserver(records=>{if(records.some(record=>!launcher.contains(record.target)&&record.target!==inline?.host))schedule();});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset'],characterData:true});
  window.addEventListener('resize',schedule);document.addEventListener('scroll',()=>{if(inline)updateInline();},true);
  document.addEventListener('pointermove',event=>{if(!inline)return;const r=inline.image.getBoundingClientRect();inline.renderer.target=[Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1)),Math.max(-1,Math.min(1,1-(event.clientY-r.top)/r.height*2))];},{passive:true});
  const timer=setInterval(()=>{if(!document.hidden)schedule();},2000);
  async function initialize(){
    try{
      if(!hasContext()){markContextStale();return;}
      chrome.storage.onChanged.addListener((changes,area)=>{if(contextStale||pageClosed||area!=='local'||!changes.settings)return;settings=S.normalize(changes.settings.newValue);surface?.update(settings);if(inline)inline.renderer.settings=settings;if(!settings.enabled){close();destroyInline();}launcher.hidden=!settings.enabled||!!surface;schedule();});
      chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(contextStale||pageClosed)return;if(message.type==='open'){open();reply({ok:!contextStale});}if(message.type==='status')reply({detected:!!track,title:track?.title,enabled:settings.enabled});});
      const result=await chrome.storage.local.get('settings');
      if(contextStale||pageClosed)return;
      settings=S.normalize(result.settings);launcher.hidden=!settings.enabled||!!surface;schedule();
    }catch(error){handleExtensionError(error,'Could not load saved settings. Using the default settings for now.');schedule();}
  }
  void initialize();
  window.addEventListener('pagehide',()=>{pageClosed=true;generation++;clearInterval(timer);clearTimeout(scanTimer);clearTimeout(saveTimer);observer.disconnect();surface?.destroy();destroyInline();},{once:true});
})();
