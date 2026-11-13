(() => {
  'use strict';
  const S=globalThis.Sparunkify;
  const players=globalThis.SparunkifyPlayers,service=players.player(location.href);
  if(!service)return;
  if(document.getElementById('sparunkify-launcher'))return;
  let settings={...S.defaults},track=null,art=null,artURL='',pendingURL='',generation=0,surface=null,inline=null,dock=null,scanTimer=null,saveTimer=null,lastFailed='',failedAt=0,contextStale=false,pageClosed=false;
  const launcher=document.createElement('div');launcher.id='sparunkify-launcher';const shadow=launcher.attachShadow({mode:'open'});
  shadow.innerHTML='<style>:host{all:initial;position:fixed;bottom:108px;right:24px;z-index:2147483500}button{font:13px Arial,sans-serif;color:#eee;background:#252525;border:1px solid #555;border-radius:5px;padding:10px 14px;cursor:pointer}button:hover{background:#333}button:focus-visible{outline:2px solid #ddd;outline-offset:3px}</style><button title="Open Sparunkify artwork view">Artwork</button>';
  document.body.append(launcher);shadow.querySelector('button').addEventListener('click',open);
  function hasContext(){try{return Boolean(chrome.runtime?.id);}catch{return false;}}
  function markContextStale(){
    if(contextStale||pageClosed)return;
    contextStale=true;generation++;pendingURL='';
    clearTimeout(saveTimer);clearTimeout(scanTimer);saveTimer=scanTimer=null;
    clearInterval(timer);observer.disconnect();destroyInline();destroyDock();
    const button=shadow.querySelector('button');button.textContent='Refresh '+service.name;
    button.title='The extension was reloaded. Refresh this tab to reconnect.';
    launcher.hidden=!!surface;
    surface?.setStatus(`Sparunkify was reloaded. Refresh this ${service.name} tab to reconnect; recent settings may not have saved.`);
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
  function open(){if(contextStale){location.reload();return;}if(!hasContext()){markContextStale();return;}if(!settings.enabled){save({...settings,enabled:true});}if(surface)return;destroyInline();destroyDock();surface=S.createSurface({settings,onSettings:save,onClose:close,playerControls:service.id==='youtube-music'?players.playback(document):null});launcher.hidden=true;if(track)surface.setTrack(track);if(art)surface.setImage(art);updateTheme();surface.root.querySelector('#close').focus();schedule();}
  function readTrack(){
    return players.readTrack(document,location.href);
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
      if(response?.error)throw new Error(response.error);if(!response?.data)throw new Error(`Refresh ${service.name} after reloading the extension.`);
      const image=new Image();image.src=response.data;await image.decode();if(token!==generation)return;
      art=image;artURL=next.url;lastFailed='';destroyInline();surface?.setImage(image);schedule();
    }catch(error){if(token!==generation)return;lastFailed=next.url;failedAt=Date.now();handleExtensionError(error,error.message);}
    finally{if(token===generation)pendingURL='';}
  }
  function destroyInline(){if(!inline)return;inline.cat?.destroy();inline.catHost?.remove();inline.renderer.destroy();inline.host.remove();inline=null;}
  function destroyDock(){if(!dock)return;dock.cat.destroy();dock.host.remove();dock=null;launcher.hidden=!settings.enabled||!!surface;}
  function updateOverlayVisibility(){
    const blocked=service.id==='youtube-music'&&players.hasOpenOverlay(document);
    launcher.style.visibility=blocked?'hidden':'';
    if(dock){dock.host.style.visibility=blocked?'hidden':'';dock.cat.active=!blocked;}
    if(inline){
      inline.host.style.visibility=!blocked&&inline.visible?'visible':'hidden';inline.renderer.active=settings.inline&&!blocked&&inline.visible;
      if(inline.catHost){inline.catHost.style.visibility=blocked?'hidden':'';const rect=inline.catHost.getBoundingClientRect();inline.cat.active=!blocked&&rect.bottom>0&&rect.top<innerHeight-90;}
    }
  }
  function updateDock(){
    if(service.id!=='youtube-music'||!settings.enabled||!settings.maxwell||!track||surface||!S.MaxwellCat){destroyDock();return;}
    if(!dock){
      const host=document.createElement('div');host.id='sparunkify-maxwell-dock';host.setAttribute('aria-label','Maxwell music companion');
      host.style.cssText='position:fixed;right:20px;width:190px;height:150px;z-index:110;pointer-events:none;overflow:hidden;contain:paint;border-radius:10px;background:#171717e8;border:1px solid #ffffff24;';
      const root=host.attachShadow({mode:'open'});root.innerHTML='<style>:host{color-scheme:dark}div{position:absolute;inset:0 0 30px;overflow:hidden}button{position:absolute;bottom:0;width:100%;height:30px;pointer-events:auto;background:transparent;color:#eee;border:0;border-top:1px solid #ffffff24;font:12px Arial;cursor:pointer}button:hover{background:#333}button:focus-visible{outline:2px solid white;outline-offset:-3px}</style><div></div><button>Open artwork</button>';
      root.querySelector('button').addEventListener('click',open);document.body.append(host);
      try{dock={host,cat:new S.MaxwellCat(root.querySelector('div'))};}catch{host.remove();return;}
    }
    dock.host.style.bottom=(players.bottomInset(document,innerHeight)+12)+'px';
    launcher.hidden=true;
    updateOverlayVisibility();
  }
  function updateInline(){
    if(!settings.enabled||(!settings.inline&&!settings.maxwell)||surface||!art||!track||artKey(artURL)!==artKey(track.url)){destroyInline();destroyDock();return;}
    const candidate=[...players.artworkImages(document,location.href)].filter(img=>artKey(img.currentSrc||img.src)===artKey(track.url)&&getComputedStyle(img).visibility!=='hidden').map(img=>({img,rect:img.getBoundingClientRect()})).filter(({rect})=>rect.width>=170&&rect.height>=170&&Math.abs(rect.width-rect.height)<20&&rect.bottom>0&&rect.top<innerHeight-90).sort((a,b)=>b.rect.width-a.rect.width)[0];
    if(!candidate){destroyInline();updateDock();return;}
    destroyDock();
    if(inline?.image!==candidate.img){
      destroyInline();const host=document.createElement('div');host.style.cssText='position:fixed;pointer-events:none;z-index:100;border-radius:8px;overflow:hidden;';host.id='sparunkify-inline';const root=host.attachShadow({mode:'open'}),canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block';root.append(canvas);document.body.append(host);
      try{const renderer=new S.Renderer(canvas,settings,()=>destroyInline());renderer.setImage(art);inline={host,renderer,image:candidate.img};}catch{host.remove();return;}
    }
    const r=candidate.rect;Object.assign(inline.host.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',borderRadius:getComputedStyle(candidate.img).borderRadius});
    inline.host.hidden=!settings.inline;
    if(settings.maxwell&&S.MaxwellCat&&!inline.cat){
      let anchor=candidate.img;
      // Insert a real layout slot below the square artwork wrapper so the cat
      // pushes track details down instead of covering them with a fixed overlay.
      for(let i=0;i<5&&anchor.parentElement;i++){
        const box=anchor.parentElement.getBoundingClientRect();
        if(Math.abs(box.width-r.width)>10||Math.abs(box.height-r.height)>10)break;
        anchor=anchor.parentElement;
      }
      // YouTube Music positions the cover inside its player. Reserve the cat's
      // space after the whole player, outside those absolute-positioned layers.
      if(service.id==='youtube-music')anchor=candidate.img.closest('ytmusic-player')||anchor;
      const catHost=document.createElement('div');catHost.id='sparunkify-maxwell';catHost.style.cssText='display:block;position:relative;width:100%;flex:0 0 auto;pointer-events:none;overflow:hidden;contain:paint;';
      anchor.after(catHost);
      try{inline.cat=new S.MaxwellCat(catHost);inline.catHost=catHost;}catch{catHost.remove();}
    }
    if(!settings.maxwell&&inline.cat){inline.cat.destroy();inline.catHost.remove();inline.cat=inline.catHost=null;}
    if(inline.catHost){inline.catHost.style.height=Math.min(180,r.width*.55)+'px';inline.catHost.style.maxWidth=r.width+'px';}
    const top=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-91,r.top+r.height/2)));
    inline.visible=!!top&&(top===candidate.img||top.contains(candidate.img)||candidate.img.parentElement?.contains(top));updateOverlayVisibility();
  }
  function updateTheme(){if(surface)surface.setTheme?.(service.id==='spotify'&&track&&S.readSpotifyTheme?S.readSpotifyTheme(track.url):null);}
  function scan(){scanTimer=null;if(contextStale||pageClosed||!settings.enabled)return;if(!hasContext()){markContextStale();return;}const next=readTrack();if(next){track=next;surface?.setTrack(next);void fetchArt(next);}else{track=null;surface?.setStatus(`No current track detected. Start a track in ${service.name}.`);}updateTheme();updateInline();}
  function schedule(){if(!contextStale&&!pageClosed&&!scanTimer)scanTimer=setTimeout(scan,300);}
  const observer=new MutationObserver(records=>{
    const changes=records.filter(record=>!record.target.closest?.('[id^="sparunkify-"]'));
    // Hide companions before the next paint when a native popup opens, rather
    // than waiting for the slower track scan. Ignore our own visibility writes.
    if(service.id==='youtube-music'&&changes.some(record=>record.type!=='attributes'||!['class','style'].includes(record.attributeName)||record.target.matches?.(players.overlaySelector)||record.target.closest?.('ytmusic-popup-container, tp-yt-iron-dropdown, tp-yt-paper-dialog')))updateOverlayVisibility();
    if(changes.some(record=>record.type!=='attributes'||['src','srcset'].includes(record.attributeName)))schedule();
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','hidden','aria-hidden','aria-expanded','open','class','style'],characterData:true});
  window.addEventListener('resize',schedule);document.addEventListener('scroll',()=>{if(inline)updateInline();},true);
  document.addEventListener('pointermove',event=>{if(!inline)return;const r=inline.image.getBoundingClientRect();inline.renderer.target=[Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1)),Math.max(-1,Math.min(1,1-(event.clientY-r.top)/r.height*2))];},{passive:true});
  const timer=setInterval(()=>{if(!document.hidden)schedule();},2000);
  async function initialize(){
    try{
      if(!hasContext()){markContextStale();return;}
      chrome.storage.onChanged.addListener((changes,area)=>{if(contextStale||pageClosed||area!=='local'||!changes.settings)return;settings=S.normalize(changes.settings.newValue);surface?.update(settings);if(inline)inline.renderer.settings=settings;if(!settings.enabled){close();destroyInline();}launcher.hidden=!settings.enabled||!!surface;schedule();});
      chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(contextStale||pageClosed)return;if(message.type==='maxwell-levels'){S.setMaxwellLevels?.(message.bass,message.level);reply({ok:true});return;}if(message.type==='open'){open();reply({ok:!contextStale});}if(message.type==='status')reply({detected:!!track,title:track?.title,artist:track?.artist,enabled:settings.enabled});});
      const result=await chrome.storage.local.get('settings');
      if(contextStale||pageClosed)return;
      settings=S.normalize(result.settings);launcher.hidden=!settings.enabled||!!surface;schedule();
    }catch(error){handleExtensionError(error,'Could not load saved settings. Using the default settings for now.');schedule();}
  }
  void initialize();
  window.addEventListener('pagehide',()=>{pageClosed=true;generation++;clearInterval(timer);clearTimeout(scanTimer);clearTimeout(saveTimer);observer.disconnect();surface?.destroy();destroyInline();destroyDock();},{once:true});
})();
