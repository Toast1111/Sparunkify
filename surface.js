(() => {
  const S=globalThis.Sparunkify;
  const style=`
    :host{all:initial;color:#eee;font:14px/1.5 Arial,sans-serif;color-scheme:dark;--album-color:18,18,18}
    *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;color:inherit;border:1px solid #444;background:#252525;border-radius:5px;padding:8px 12px}button:hover{background:#333}button:disabled{opacity:.45;cursor:default}
    button:focus-visible,input:focus-visible{outline:2px solid #ddd;outline-offset:3px}button[aria-pressed=true]{background:#ddd;color:#171717;border-color:#ddd}
    .room{position:fixed;inset:0 0 90px;z-index:2147483600;overflow:auto;background:linear-gradient(180deg,transparent,rgba(0,0,0,.18)),rgb(var(--album-color));display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto 1fr;align-content:start}
    .room.demo{inset:0}header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 20px;border-bottom:1px solid #303030}.brand{font-size:15px;font-weight:600}.actions{display:flex;flex-wrap:wrap;gap:8px}.actions button{font-size:13px}
    main{min-width:0;display:flex;flex-direction:column;align-items:center;padding:22px 24px 24px}.eyebrow{font-size:12px;color:#c0c0c0;margin:0 0 16px}
    .stage{position:relative;width:min(56vh,640px,100%);aspect-ratio:1;flex-shrink:0;perspective:1000px}.sleeve{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform .16s ease-out;border-radius:5px;background:#202020;overflow:hidden}.sleeve canvas,.sleeve img{width:100%;height:100%;display:block;object-fit:cover;position:absolute;inset:0}.sleeve canvas{opacity:0}.sleeve.ready canvas{opacity:1}.sleeve.original canvas{opacity:0}
    .under-art{font-size:12px;color:#c0c0c0;margin:14px 0 0}.metadata{text-align:center;max-width:100%;overflow-wrap:anywhere}.metadata h1{font-size:20px;line-height:1.3;margin:8px 0 4px;font-weight:600}.artist{color:#c0c0c0;font-size:14px;margin:0 0 16px}.hint{font-size:12px;color:#c0c0c0;text-align:center;margin:0}.footer{margin-top:18px;font-size:12px;color:#c0c0c0;text-align:center;overflow-wrap:anywhere}
    .panel{min-width:0;background:#191919;padding:20px;border-top:1px solid #303030}.panel[hidden]{display:none}.panel h2{font-size:15px;margin:0 0 20px}.field-label{font-size:13px;color:#bbb;margin:0 0 8px}.material-pills{display:flex;gap:5px;margin-bottom:24px}.material-pills button{flex:1;padding:7px 8px;font-size:12px}
    .control{display:block;margin:20px 0}.control span{display:flex;justify-content:space-between;gap:8px;font-size:13px}.control output{color:#bbb;font-variant-numeric:tabular-nums}.control input{width:100%;height:16px;margin:10px 0 0;accent-color:#ccc;cursor:pointer}.check{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;margin:18px 0}.check input{accent-color:#ccc;width:16px;height:16px}.reset{width:100%;font-size:13px;margin-top:8px}.caption{font-size:12px;line-height:1.5;color:#c0c0c0;margin:16px 0 0}
    .empty{position:absolute;inset:0;display:grid;place-content:center;padding:24px;text-align:center;font-size:16px;color:#ccc}.empty small{font-size:13px;margin-top:8px}.empty[hidden],.sleeve img[hidden],.file{display:none}
    @media(min-width:900px){.room.settings-open{grid-template-columns:minmax(0,1fr) 280px}.panel{grid-column:2;grid-row:2;border-top:0;border-left:1px solid #303030}}
    @media(max-width:650px){header{align-items:flex-start;flex-direction:column;padding:12px 16px;gap:10px}.actions{gap:6px}.actions button{font-size:12px;padding:7px 10px}main{padding:20px 16px}.stage{width:min(52vh,100%)}.panel{padding:20px 16px}}
    .sleeve:has(canvas[aria-label="Generated grayscale displacement map"]){transition:none}
    .maxwell-slot{position:relative;width:min(56vh,640px,100%);height:180px;flex-shrink:0;overflow:hidden;contain:paint}.maxwell-slot[hidden]{display:none}
    .room.player-view{inset:0;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}
    .player-view header{background:#141414e8;position:relative;z-index:1}
    .player-view main{min-height:0;overflow:auto;justify-content:center;gap:8px;padding:16px 24px}
    .player-view .stage{width:min(100%,var(--art-size,50vh))}
    .player-view .maxwell-slot{width:min(100%,var(--art-size,50vh));height:var(--cat-height,120px)}
    .player-view .metadata{width:100%;color:white;text-shadow:0 1px 4px #0009}
    .player-view .metadata h1{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin:0 0 4px;font-size:18px}
    .player-view .metadata .artist{color:#fff;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .player-view .eyebrow,.player-view .under-art,.player-view .hint,.player-view .footer{display:none}
    .transport{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;padding:12px 20px;background:#141414;color:#eee;border-top:1px solid #444}
    .transport .seek{display:flex;align-items:center;gap:10px;width:min(100%,700px);font-size:12px;font-variant-numeric:tabular-nums}
    .transport .playback-actions{display:flex;justify-content:center;gap:10px;width:100%}
    .transport input{flex:1;min-width:40px;accent-color:#ddd;cursor:pointer}.transport button{min-height:38px}
    .transport .play{background:#eee;color:#111;min-width:80px}.transport .browse{margin-left:12px}
    .transport .error{width:100%;margin:0;font-size:12px;text-align:center;color:#ffb4ab}.transport .error[hidden]{display:none}
    @media(min-width:900px){.player-view .panel{min-height:0;overflow:auto}}
    @media(max-width:899px){.player-view.settings-open{overflow:auto;grid-template-rows:auto minmax(420px,1fr) auto auto}.player-view .transport{position:sticky;bottom:0}.player-view .panel{grid-row:3}}
    @media(max-width:650px){.player-view header{flex-direction:row;align-items:center;gap:8px;padding:10px 12px}.player-view .brand{display:none}.player-view .actions{gap:4px}.player-view .actions button{padding:7px 8px}.player-view main{padding:12px}.transport{gap:6px;padding:8px 10px}.transport .browse{margin-left:0}}
    @media(prefers-reduced-motion:reduce){*{transition:none!important}}
  `;
  S.createSurface=function({settings,onSettings,onClose,demo=false,playerControls=null}) {
    const host=document.createElement('div');host.id='sparunkify-room';const root=host.attachShadow({mode:'open'});
    root.innerHTML=`<style>${style}</style>
      <section class="room ${demo?'demo':''} ${playerControls?'player-view':''}" role="dialog" aria-label="Sparunkify artwork view">
        <header><div class="brand">Sparunkify</div><div class="actions">
          ${demo?'<button id="upload">Open image</button><input class="file" id="file" type="file" accept="image/png,image/jpeg,image/webp">':''}
          <button id="compare" aria-pressed="false">Original</button>
          <button id="displacement" aria-pressed="false" disabled title="Inspect the generated height map">Height map</button>
          <button id="tune" aria-controls="settings-panel" aria-expanded="false">Settings</button>
          ${playerControls?'<button id="fullscreen">Full screen</button>':''}
          <button id="close" aria-label="Close artwork view">Close</button>
        </div></header>
        <main>
          <div class="eyebrow" id="source">${demo?'Image preview':'Now playing'}</div>
          <div class="stage"><div class="sleeve"><img alt="Album artwork" hidden><canvas aria-label="Procedurally illuminated album artwork"></canvas><div class="empty">Waiting for artwork<small>Play a track in your music player.</small></div></div></div>
          <div class="maxwell-slot" hidden aria-label="Maxwell below the artwork"></div>
          <div class="under-art">Effects on</div>
          <div class="metadata"><h1 id="title">No track selected</h1><p class="artist" id="artist"></p></div>
          <p class="hint">Move the pointer over the artwork to tilt it.</p>
          <div class="footer"><div class="status" role="status" id="status">${demo?'Open an image to preview it locally.':'Waiting for player artwork'}</div></div>
        </main>
        <aside class="panel" id="settings-panel" aria-label="Effect settings" hidden>
          <h2>Effect settings</h2><p class="field-label">Finish</p>
          <div class="material-pills" aria-label="Material preset"><button data-preset="foil">Foil</button><button data-preset="gloss">Gloss</button><button data-preset="embossed">Embossed</button></div>
          ${[['depth','Relief'],['roughness','Roughness'],['shine','Reflection'],['sparkle','Sparkle']].map(([id,label])=>`<label class="control"><span>${label}<output for="${id}"></output></span><input id="${id}" type="range" min="0" max="100"></label>`).join('')}
          <label class="check">Animate reflections<input id="motion" type="checkbox"></label>
          <label class="check">Tilt with pointer<input id="parallax" type="checkbox"></label>
          <button class="reset" id="reset">Reset finish</button>
          <p class="caption">Higher roughness softens reflections.</p>
        </aside>
        ${playerControls?'<nav class="transport" aria-label="Music playback"><div class="seek"><span id="elapsed">0:00</span><input id="seek" aria-label="Seek in track" type="range" min="0" max="1" step="0.1" value="0" disabled><span id="duration">0:00</span></div><div class="playback-actions"><button id="previous" aria-label="Previous track">Previous</button><button id="play" class="play" aria-label="Play">Play</button><button id="next" aria-label="Next track">Next</button><button id="browse" class="browse">Browse music</button></div><p class="error" id="transport-error" role="status" hidden></p></nav>':''}
      </section>`;
    document.body.append(host);const $=s=>root.querySelector(s),canvas=$('canvas'),sleeve=$('.sleeve'),fallback=$('img');let renderer=null,cat=null,currentImage=null,disposed=false,viewMode='effects',nativeTheme=null,transportTimer=null,layoutObserver=null,seeking=false;
    const surface={host,root,settings:S.normalize(settings),setTheme(theme){nativeTheme=theme;applyTheme();},setStatus(message){$('#status').textContent=message;},setTrack(track){$('#title').textContent=track.title||'Untitled track';$('#artist').textContent=track.artist||'Spotify';$('#source').textContent=demo?'Image preview':'Now playing';},setImage(image){currentImage=image;fallback.src=image.src;fallback.hidden=false;$('.empty').hidden=true;try{if(!renderer)renderer=new S.Renderer(canvas,surface.settings,message=>{sleeve.classList.remove('ready');$('#displacement').disabled=true;setView('effects');surface.setStatus(message);});host.style.setProperty('--album-color',renderer.setImage(image));applyTheme();sleeve.classList.add('ready');$('#displacement').disabled=false;setView(viewMode);surface.setStatus(`Artwork: ${image.naturalWidth} x ${image.naturalHeight}${image.naturalWidth<640?' / Higher-resolution artwork unavailable':''}`);}catch(error){sleeve.classList.remove('ready');$('#displacement').disabled=true;setView('effects');surface.setStatus(error.message);}},update(next){surface.settings=S.normalize(next);if(renderer)renderer.settings=surface.settings;sync();},destroy(){disposed=true;renderer?.destroy();cat?.destroy();document.removeEventListener('keydown',keydown);host.remove();}};
    function syncCat(){const slot=$('.maxwell-slot'),enabled=surface.settings.enabled&&surface.settings.maxwell&&S.MaxwellCat;
      if(enabled&&!cat){try{cat=new S.MaxwellCat(slot,message=>surface.setStatus(message));}catch(error){surface.setStatus(error.message);}}
      if(!enabled&&cat){cat.destroy();cat=null;}slot.hidden=!enabled||viewMode!=='effects';if(cat)cat.active=!slot.hidden;fitPlayer();
    }
    function fitPlayer(){
      if(!playerControls||disposed)return;
      const main=$('main'),room=$('.room'),style=getComputedStyle(main);
      const height=main.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
      const catHeight=$('.maxwell-slot').hidden?0:Math.max(70,Math.min(150,height*.2));
      const available=height-$('.metadata').getBoundingClientRect().height-catHeight-(catHeight?16:8);
      room.style.setProperty('--cat-height',catHeight+'px');
      room.style.setProperty('--art-size',Math.max(80,Math.min(main.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),available))+'px');
    }
    if(playerControls){
      const originalTrack=surface.setTrack,originalDestroy=surface.destroy;
      surface.setTrack=track=>{originalTrack(track);fitPlayer();};
      const transportError=message=>{const error=$('#transport-error');error.textContent=message;error.hidden=!message;};
      const time=value=>{const seconds=Math.max(0,Math.floor(value||0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
      function refreshTransport(){
        if(disposed)return;
        const state=playerControls.state();
        $('#play').textContent=state.paused?'Play':'Pause';$('#play').setAttribute('aria-label',state.paused?'Play':'Pause');$('#play').disabled=!state.available;
        $('#previous').disabled=!state.previous;$('#next').disabled=!state.next;
        $('#seek').disabled=state.duration<=0;$('#seek').max=state.duration||1;
        if(!seeking)$('#seek').value=state.currentTime;
        $('#elapsed').textContent=time(seeking?Number($('#seek').value):state.currentTime);$('#duration').textContent=time(state.duration);
      }
      for(const [id,action] of [['previous','previous'],['play','toggle'],['next','next']])$('#'+id).addEventListener('click',async()=>{
        transportError('');try{await playerControls.action(action);refreshTransport();}catch{transportError('Playback unavailable. Select Browse music to use the player controls.');}
      });
      $('#seek').addEventListener('input',()=>{seeking=true;$('#elapsed').textContent=time(Number($('#seek').value));});
      $('#seek').addEventListener('change',()=>{transportError('');try{playerControls.seek(Number($('#seek').value));}catch{transportError('Could not seek. Try again after the track loads.');}finally{seeking=false;refreshTransport();}});
      $('#browse').addEventListener('click',()=>onClose?.());
      const fullscreenChanged=()=>{$('#fullscreen').textContent=document.fullscreenElement===host?'Exit full screen':'Full screen';fitPlayer();};
      $('#fullscreen').addEventListener('click',async()=>{transportError('');try{if(document.fullscreenElement===host)await document.exitFullscreen();else await host.requestFullscreen();}catch{transportError('Full screen is unavailable. The view still fills this browser tab.');}});
      document.addEventListener('fullscreenchange',fullscreenChanged);
      layoutObserver=new ResizeObserver(fitPlayer);layoutObserver.observe($('main'));layoutObserver.observe($('.metadata'));
      transportTimer=setInterval(refreshTransport,250);refreshTransport();
      surface.destroy=()=>{clearInterval(transportTimer);layoutObserver.disconnect();document.removeEventListener('fullscreenchange',fullscreenChanged);if(document.fullscreenElement===host)void document.exitFullscreen().catch(()=>{});originalDestroy();};
    }
    function applyTheme(){const room=$('.room');room.style.backgroundColor=nativeTheme?.color||'';room.style.backgroundImage=nativeTheme?.image||'';room.dataset.themeSource=nativeTheme?'spotify':'artwork';}
    function sync(){syncCat();for(const key of ['depth','roughness','shine','sparkle']){$('#'+key).value=surface.settings[key];$(`output[for="${key}"]`).textContent=surface.settings[key]+'%';}for(const key of ['motion','parallax'])$('#'+key).checked=surface.settings[key];root.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.preset===surface.settings.preset));}
    function change(patch){if(viewMode==='original')setView('effects');surface.update({...surface.settings,...patch});onSettings?.(surface.settings);}
    root.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>change({preset:button.dataset.preset,...S.presets[button.dataset.preset]})));
    for(const key of ['depth','roughness','shine','sparkle'])$('#'+key).addEventListener('input',event=>change({[key]:Number(event.target.value)}));
    for(const key of ['motion','parallax'])$('#'+key).addEventListener('change',event=>change({[key]:event.target.checked}));
    $('#reset').addEventListener('click',()=>change(S.presets[surface.settings.preset]));
    $('#tune').addEventListener('click',()=>{const panel=$('.panel');panel.hidden=!panel.hidden;$('#tune').setAttribute('aria-expanded',String(!panel.hidden));$('.room').classList.toggle('settings-open',!panel.hidden);});
    const defaultHint=$('.hint').textContent;
    function setView(mode){
      viewMode=mode;syncCat();
      const displacement=mode==='displacement',original=mode==='original';
      if(renderer){renderer.showDisplacement=displacement;renderer.target=[0,0];}
      sleeve.classList.toggle('original',original);
      sleeve.style.transform='';
      $('#compare').textContent=original?'Show effects':'Original';
      $('#compare').setAttribute('aria-pressed',String(original));
      $('#displacement').textContent=displacement?'Show effects':'Height map';
      $('#displacement').setAttribute('aria-pressed',String(displacement));
      canvas.setAttribute('aria-label',displacement?'Generated grayscale displacement map':'Procedurally illuminated album artwork');
      $('.hint').textContent=displacement?'Height map: light areas are raised; dark areas are recessed.':original?'Original artwork. Select Show effects to compare.':defaultHint;
      $('.under-art').textContent=displacement?'Height map':original?'Original':'Effects on';
    }
    $('#compare').addEventListener('click',()=>setView(viewMode==='original'?'effects':'original'));
    $('#displacement').addEventListener('click',()=>setView(viewMode==='displacement'?'effects':'displacement'));
    const close=()=>{if(demo){$('.panel').hidden=true;$('.room').classList.remove('settings-open');$('#tune').setAttribute('aria-expanded','false');surface.setStatus('This is the standalone preview. Close this browser tab to exit.');}else onClose?.();};
    $('#close').addEventListener('click',close);function keydown(event){if(event.key==='Escape'&&document.fullscreenElement!==host)close();}document.addEventListener('keydown',keydown);
    $('.stage').addEventListener('pointermove',event=>{if(!renderer||viewMode==='displacement'||!surface.settings.parallax||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rect=$('.stage').getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*2-1,y=(event.clientY-rect.top)/rect.height*2-1;renderer.target=[x,-y];sleeve.style.transform=`rotateX(${-y*5}deg) rotateY(${x*6}deg)`;});
    $('.stage').addEventListener('pointerleave',()=>{if(renderer)renderer.target=[0,0];sleeve.style.transform='';});
    if(demo){$('#upload').addEventListener('click',()=>$('#file').click());$('#file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;if(file.size>20*1024*1024){surface.setStatus('Choose an image smaller than 20 MB.');return;}const url=URL.createObjectURL(file),image=new Image();try{image.src=url;await image.decode();if(disposed)return;surface.setTrack({title:file.name.replace(/\.[^.]+$/,''),artist:'Your artwork · stays on this device'});surface.setImage(image);}catch{surface.setStatus('That image could not be opened. Try a PNG, JPEG or WebP.');}finally{URL.revokeObjectURL(url);}});}
    sync();setView('effects');return surface;
  };
})();
