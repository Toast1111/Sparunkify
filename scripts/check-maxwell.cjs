// Optional browser QA: node scripts/check-maxwell.cjs <path to playwright> [Chromium executable]
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/maxwell-qa');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png'};
(async()=>{
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('sparunkify-demo',JSON.stringify({maxwell:true})));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.locator('.sleeve.ready').waitFor();await page.locator('.maxwell-slot canvas').waitFor();
    const art=await page.locator('.stage').boundingBox(),cat=await page.locator('.maxwell-slot').boundingBox();
    assert.ok(cat.y>=art.y+art.height,'Cat must be below, never over, the artwork');
    await page.screenshot({path:path.join(out,'below-artwork.png')});
    await page.locator('#compare').click();assert.equal(await page.locator('.maxwell-slot').isVisible(),false);
    await page.locator('#compare').click();assert.equal(await page.locator('.maxwell-slot').isVisible(),true);
    // Check the visible GPU deformation as well as the controller's recovery.
    const motion=await page.evaluate(async()=>{
      const host=document.createElement('div');host.style.cssText='position:fixed;right:0;bottom:0;width:300px;height:200px';document.body.append(host);
      const cat=new Sparunkify.MaxwellCat(host);await cat.renderer.ready;
      const poses=[],draw=cat.renderer.draw.bind(cat.renderer);cat.renderer.draw=pose=>{poses.push(pose);draw(pose);};
      for(let i=0;i<100;i++){const energy=i%25===2?.8:.04;Sparunkify.setMaxwellLevels(energy,energy);await new Promise(resolve=>setTimeout(resolve,20));}
      await new Promise(resolve=>setTimeout(resolve,500));
      cat.active=false;
      function bounds(energy){
        draw({yaw:-1.05,energy});const gl=cat.renderer.gl,w=cat.canvas.width,h=cat.canvas.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let left=w,right=0,bottom=h,top=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);}
        return {width:right-left,height:top-bottom,clipped:left===0||right===w-1||bottom===0||top===h-1};
      }
      const shapes=[0,.25,1,4,100].map(energy=>bounds(energy)),restored=bounds(0),result={shapes,restored,peak:Math.max(...poses.map(p=>p.energy)),rebound:Math.min(...poses.map(p=>p.energy)),tail:poses.at(-1).energy};
      cat.destroy();host.remove();return result;
    });
    assert.ok(motion.peak>.6&&motion.rebound<-.1&&Math.abs(motion.tail)<.05,'Hits must ease in, rebound and recover: '+JSON.stringify(motion));
    const [normal,soft,medium,hard,maximum]=motion.shapes;
    assert.ok(normal.height>soft.height&&soft.height>medium.height&&medium.height>hard.height&&hard.height>=maximum.height,'Rendered squishes must have distinct middle shapes: '+JSON.stringify(motion.shapes));
    assert.ok(maximum.height>normal.height*.55&&maximum.width<normal.width*1.5,'Maxwell must stay recognizably a cat at maximum squish');
    assert.deepEqual(motion.restored,normal,'Loud hits must not zoom the camera or change the resting size');
    assert.ok(await page.locator('.maxwell-slot').evaluate(el=>getComputedStyle(el).contain==='paint'&&getComputedStyle(el).overflow==='hidden'),'Cat paint must stay inside its below-artwork slot');
    // Exercise the same analysis using an actual Web Audio tone.
    const bass=await page.evaluate(async()=>{
      const audio=new AudioContext(),tone=audio.createOscillator(),analyser=audio.createAnalyser();analyser.fftSize=2048;tone.frequency.value=90;tone.connect(analyser);tone.start();await audio.resume();
      await new Promise(resolve=>setTimeout(resolve,150));
      const f=new Float32Array(analyser.frequencyBinCount),w=new Float32Array(analyser.fftSize);analyser.getFloatFrequencyData(f);analyser.getFloatTimeDomainData(w);
      const result=MaxwellAudio.analyse(f,w,audio.sampleRate,analyser.fftSize);Sparunkify.setMaxwellLevels(result.bass,result.level);tone.stop();await audio.close();return result.bass;
    });assert.ok(bass>0);
    await page.setViewportSize({width:390,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const narrowArt=await page.locator('.stage').boundingBox(),narrowCat=await page.locator('.maxwell-slot').boundingBox();assert.ok(narrowCat.y>=narrowArt.y+narrowArt.height);
    await page.screenshot({path:path.join(out,'below-artwork-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    // Load the actual extension in a separate Chromium profile and exercise the
    // normal Spotify integration against a controlled page, including asset URLs.
    const cover=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=300;const g=c.getContext('2d');g.fillStyle='#303a70';g.fillRect(0,0,300,300);return c.toDataURL().split(',')[1];});
    // Playwright removes its temporary profile when the context closes.
    const extension=await chromium.launchPersistentContext('',{executablePath:process.argv[3]||chromium.executablePath(),headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1100,height:950}});
    try{
      const worker=extension.serviceWorkers()[0]||await extension.waitForEvent('serviceworker');
      await worker.evaluate(base64=>{globalThis.fetch=async()=>new Response(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),{headers:{'content-type':'image/png'}});},cover);
      const url='https://i.scdn.co/image/ab67616d0000b273ff9ca10b55ce82ae553c8228';
      await extension.route('https://i.scdn.co/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(cover,'base64')}));
      await extension.route('https://open.spotify.com/**',route=>route.fulfill({contentType:'text/html',body:`<title>Spotify integration fixture</title><body style="background:#222;color:white;font:16px Arial;margin:30px"><aside style="width:300px"><div style="width:300px;height:300px"><img id="cover" src="${url}" width="300" height="300"></div><h2 id="details">Track details</h2></aside><footer data-testid="now-playing-widget" style="position:fixed;bottom:0;height:90px"><img src="${url}" width="60" height="60"><a data-testid="nowplaying-track-link">Test track</a></footer>`}));
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:true,maxwell:true}}));
      const spotify=await extension.newPage(),integrationErrors=[];spotify.on('pageerror',error=>integrationErrors.push(error.message));
      await spotify.goto('https://open.spotify.com/');await spotify.locator('#sparunkify-maxwell canvas').waitFor();
      const coverBox=await spotify.locator('#cover').boundingBox(),catBox=await spotify.locator('#sparunkify-maxwell').boundingBox(),details=await spotify.locator('#details').boundingBox();
      assert.ok(catBox.y>=coverBox.y+coverBox.height);assert.ok(details.y>=catBox.y+catBox.height,'Cat must reserve space before track details');
      assert.ok(await spotify.locator('#sparunkify-maxwell').evaluate(el=>getComputedStyle(el).contain==='paint'&&getComputedStyle(el).overflow==='hidden'));
      await worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({url:'https://open.spotify.com/*'});await chrome.tabs.sendMessage(tab.id,{type:'maxwell-levels',bass:.9,level:.8});});
      await spotify.screenshot({path:path.join(out,'spotify-inline.png')});
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:false,maxwell:true}}));
      await spotify.waitForFunction(()=>document.getElementById('sparunkify-inline')?.hidden===true);assert.ok(await spotify.locator('#sparunkify-maxwell').isVisible());
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:false,maxwell:false}}));
      await spotify.locator('#sparunkify-maxwell').waitFor({state:'detached'});assert.deepEqual(integrationErrors,[]);
      // YouTube Music adapter: actual extension scripts on a controlled player
      // layout with a positioned cover, size variants and unrelated library art.
      const small='https://lh3.googleusercontent.com/album-one=w60-h60-l90-rj',large=small.replace('w60-h60','w544-h544');
      await extension.route('https://lh3.googleusercontent.com/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(cover,'base64')}));
      await extension.route('https://i.ytimg.com/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(cover,'base64')}));
      await extension.route('https://music.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>YouTube Music integration fixture</title><style>body{background:#111;color:white;font:16px Arial;margin:30px}main{display:flex;flex-direction:column;width:300px}ytmusic-player{display:block;position:relative;width:300px;height:300px}#song-image{position:absolute;inset:0}#song-image img{display:block;width:300px;height:300px}ytmusic-player-bar{display:block;position:fixed;bottom:0;height:72px}ytmusic-player-bar img{width:48px;height:48px}.library{position:absolute;left:400px;top:30px;width:400px;height:400px}</style><main><ytmusic-player><div id="song-image"><img id="cover" src="${large}"></div></ytmusic-player><h2 id="details">Track details</h2></main><img class="library" src="https://lh3.googleusercontent.com/unrelated=w800-h800"><ytmusic-player-bar><img class="image" src="${small}"><span class="title">First YouTube song</span><span class="byline"><a href="/channel/demo">Demo artist</a> • Demo album</span></ytmusic-player-bar>`}));
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:true,maxwell:true}}));
      const youtube=await extension.newPage();youtube.on('pageerror',error=>integrationErrors.push(error.message));
      await youtube.goto('https://music.youtube.com/');await youtube.locator('#sparunkify-maxwell canvas').waitFor();
      await youtube.evaluate(async()=>{
        globalThis.fixturePaused=true;globalThis.fixtureActions=[];
        const video=document.createElement('video');video.className='html5-main-video';video.hidden=true;
        // Use real media properties across the isolated content-script world.
        // JavaScript getter overrides in the fixture's main world aren't shared.
        const bytes=new Uint8Array(44+8000*120),data=new DataView(bytes.buffer),word=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
        word(0,'RIFF');data.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');data.setUint32(16,16,true);data.setUint16(20,1,true);data.setUint16(22,1,true);data.setUint32(24,8000,true);data.setUint32(28,8000,true);data.setUint16(32,1,true);data.setUint16(34,8,true);word(36,'data');data.setUint32(40,bytes.length-44,true);bytes.fill(128,44);
        video.src=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));video.muted=true;document.body.append(video);
        await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('Fixture media failed to load'));});video.currentTime=30;
        const controls=document.createElement('div');controls.setAttribute('aria-label','PLAYBACK_CONTROLS');controls.style.cssText='position:fixed;bottom:0;left:0;width:100%;height:72px;background:#222;z-index:200';
        for(const [label,action] of [['Previous','previous'],['Play','toggle'],['Next','next']]){
          const button=document.createElement('button');button.setAttribute('aria-label',label);button.textContent=label;
          button.onclick=()=>{fixtureActions.push(action);if(action==='toggle'){fixturePaused=!fixturePaused;if(fixturePaused)video.pause();else void video.play();button.setAttribute('aria-label',fixturePaused?'Play':'Pause');}};controls.append(button);
        }
        document.body.append(controls);
      });
      const youtubeArt=await youtube.locator('#cover').boundingBox(),youtubeCat=await youtube.locator('#sparunkify-maxwell').boundingBox(),youtubeDetails=await youtube.locator('#details').boundingBox();
      assert.ok(youtubeCat.y>=youtubeArt.y+youtubeArt.height,'YouTube cat must be outside the positioned artwork');
      assert.ok(youtubeDetails.y>=youtubeCat.y+youtubeCat.height,'YouTube cat must reserve layout space');
      assert.equal(await youtube.locator('#sparunkify-maxwell').evaluate(el=>el.previousElementSibling.tagName),'YTMUSIC-PLAYER');
      const overlay=await youtube.locator('#sparunkify-inline').boundingBox();assert.equal(overlay.x,youtubeArt.x);assert.equal(overlay.width,youtubeArt.width);
      await youtube.screenshot({path:path.join(out,'youtube-music-inline.png')});
      await youtube.locator('#sparunkify-launcher button').click();
      await youtube.locator('#sparunkify-room .sleeve.ready').waitFor();
      assert.equal(await youtube.locator('#sparunkify-room #title').textContent(),'First YouTube song');
      assert.equal(await youtube.locator('#sparunkify-room #artist').textContent(),'Demo artist');
      assert.equal(await youtube.locator('#sparunkify-room .room').getAttribute('data-theme-source'),'artwork');
      const room=await youtube.locator('#sparunkify-room .room').boundingBox(),transport=await youtube.locator('#sparunkify-room .transport').boundingBox();
      assert.equal(room.x,0);assert.equal(room.y,0);assert.equal(room.width,1100);assert.equal(room.height,950,'Artwork view must fill the entire viewport');
      const fittedArt=await youtube.locator('#sparunkify-room .stage').boundingBox(),fittedCat=await youtube.locator('#sparunkify-room .maxwell-slot').boundingBox(),metadata=await youtube.locator('#sparunkify-room .metadata').boundingBox();
      assert.ok(fittedCat.y>=fittedArt.y+fittedArt.height&&metadata.y>=fittedCat.y+fittedCat.height&&metadata.y+metadata.height<=transport.y,'Artwork, cat and track details must fit above playback controls');
      await youtube.locator('#sparunkify-room #play').click();await youtube.waitForFunction(()=>!document.querySelector('video').paused);
      await youtube.locator('#sparunkify-room #next').click();await youtube.locator('#sparunkify-room #previous').click();
      assert.deepEqual(await youtube.evaluate(()=>fixtureActions),['next','previous']);
      await youtube.locator('#sparunkify-room #seek').fill('90');await youtube.locator('#sparunkify-room #seek').dispatchEvent('change');
      assert.ok(Math.abs(await youtube.locator('video').evaluate(el=>el.currentTime)-90)<.5,'Seek must update the real playing media position');
      await youtube.locator('#sparunkify-room #play').click();await youtube.waitForFunction(()=>document.querySelector('video').paused);
      await youtube.locator('#sparunkify-room #fullscreen').click();await youtube.waitForFunction(()=>document.fullscreenElement?.id==='sparunkify-room');
      await youtube.locator('#sparunkify-room #fullscreen').click();await youtube.waitForFunction(()=>!document.fullscreenElement);
      await youtube.screenshot({path:path.join(out,'youtube-music-player-view.png')});
      // A route change replaces both the CDN image identity and the metadata.
      await youtube.evaluate(()=>{
        document.querySelector('ytmusic-player-bar .title').textContent='Second YouTube song';
        document.querySelector('ytmusic-player-bar img').src='https://i.ytimg.com/vi/second/hqdefault.jpg';
        document.querySelector('#cover').src='https://i.ytimg.com/vi/second/maxresdefault.jpg';
      });
      await youtube.waitForFunction(()=>document.querySelector('#sparunkify-room').shadowRoot.querySelector('#title').textContent==='Second YouTube song');
      await youtube.locator('#sparunkify-room .sleeve.ready').waitFor();
      await youtube.locator('#sparunkify-room #close').click();await youtube.locator('#sparunkify-maxwell canvas').waitFor();
      // No large artwork in video/closed-player mode: don't cover unrelated art.
      await youtube.locator('#song-image').evaluate(el=>el.style.display='none');
      await youtube.locator('#sparunkify-maxwell').waitFor({state:'detached'});
      await youtube.locator('#sparunkify-maxwell-dock canvas').waitFor();
      const dockBox=await youtube.locator('#sparunkify-maxwell-dock').boundingBox();assert.ok(dockBox.y+dockBox.height<=950-72,'Browsing dock must stay above native playback controls');
      await youtube.screenshot({path:path.join(out,'youtube-music-browsing-dock.png')});
      // Native menus can have a lower z-index than the dock. They must remain
      // clickable even where the dock's artwork button was covering the page.
      for(const kind of ['menu','dropdown','dialog']){
        const hidden=await youtube.evaluate(async kind=>{
          const dock=document.getElementById('sparunkify-maxwell-dock');
          globalThis.fixtureDockCanvas=dock.shadowRoot.querySelector('canvas');
          const overlay=document.createElement(kind==='dropdown'?'tp-yt-iron-dropdown':'div');overlay.id='fixture-overlay';
          if(kind!=='dropdown')overlay.setAttribute('role',kind);
          overlay.style.cssText='position:fixed;right:20px;bottom:84px;width:240px;height:300px;background:#444;z-index:5;';
          overlay.innerHTML='<button id="fixture-menu-action" style="position:absolute;bottom:0;right:0;width:190px;height:150px">Native menu action</button>';
          overlay.querySelector('button').onclick=()=>globalThis.fixtureMenuClicked=true;
          document.body.append(overlay);await new Promise(requestAnimationFrame);
          return getComputedStyle(dock).visibility;
        },kind);
        assert.equal(hidden,'hidden',`${kind} must hide the dock before the next paint`);
        await youtube.locator('#fixture-menu-action').click();assert.equal(await youtube.evaluate(()=>fixtureMenuClicked),true);
        await youtube.locator('#fixture-overlay').evaluate(el=>el.setAttribute('aria-hidden','true'));
        await youtube.locator('#sparunkify-maxwell-dock canvas').waitFor();
        assert.equal(await youtube.evaluate(()=>document.getElementById('sparunkify-maxwell-dock').shadowRoot.querySelector('canvas')===fixtureDockCanvas),true,'Closing a menu must resume the same cat, not recreate it');
        // Exercise a persistent dropdown reopening through style/ARIA changes.
        await youtube.locator('#fixture-overlay').evaluate(el=>el.removeAttribute('aria-hidden'));
        await youtube.locator('#sparunkify-maxwell-dock').waitFor({state:'hidden'});
        await youtube.locator('#fixture-overlay').evaluate(el=>el.style.display='none');
        await youtube.locator('#sparunkify-maxwell-dock canvas').waitFor();
        await youtube.locator('#fixture-overlay').evaluate(el=>el.remove());
      }
      assert.equal(await youtube.evaluate(()=>{
        const dock=document.getElementById('sparunkify-maxwell-dock'),rect=dock.getBoundingClientRect();
        const target=document.createElement('button');target.id='fixture-under-cat';target.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:100px;z-index:1;`;document.body.append(target);
        const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+45)?.id;target.remove();return hit;
      }),'fixture-under-cat','The cat itself must not intercept page clicks');
      await youtube.locator('ytmusic-player').evaluate(el=>el.setAttribute('role','dialog'));
      await youtube.locator('#sparunkify-maxwell-dock canvas').waitFor();
      await youtube.locator('#sparunkify-maxwell-dock button').click();await youtube.locator('#sparunkify-room .sleeve.ready').waitFor();
      assert.equal(await youtube.locator('#sparunkify-room #title').textContent(),'Second YouTube song');
      await youtube.locator('#sparunkify-room #browse').click();await youtube.locator('#sparunkify-maxwell-dock canvas').waitFor();
      await youtube.locator('#song-image').evaluate(el=>el.style.display='');await youtube.locator('#sparunkify-maxwell canvas').waitFor();
      await youtube.setViewportSize({width:390,height:950});
      assert.ok(await youtube.locator('#sparunkify-maxwell').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
      await youtube.locator('#sparunkify-launcher button').click();await youtube.locator('#sparunkify-room .sleeve.ready').waitFor();
      const mobileTransport=await youtube.locator('#sparunkify-room .transport').boundingBox(),mobileDetails=await youtube.locator('#sparunkify-room .metadata').boundingBox();
      assert.ok(mobileTransport.y+mobileTransport.height<=950&&mobileDetails.y+mobileDetails.height<=mobileTransport.y,'Playback and track details must fit in the narrow player view');
      await youtube.screenshot({path:path.join(out,'youtube-music-player-mobile.png')});
      await youtube.locator('#sparunkify-room #browse').click();await youtube.locator('#sparunkify-maxwell canvas').waitFor();
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:true,maxwell:false}}));
      await youtube.locator('#sparunkify-maxwell').waitFor({state:'detached'});assert.deepEqual(integrationErrors,[]);
      // Modern markup observed in the live player: there is no player-bar tag,
      // title/byline use camel-case classes, and artist anchors have no href.
      await youtube.evaluate(()=>{
        const old=document.querySelector('ytmusic-player-bar');
        const modern=document.createElement('ytmusic-track-info');
        modern.style.cssText=old.style.cssText;modern.setAttribute('aria-label','Now playing');
        modern.innerHTML='<img class="ytmusicTrackInfoThumbnail" src="https://lh3.googleusercontent.com/modern-cover=w60-h60-l90-rj"><div class="ytmusicTrackInfoTitle"><span>Modern player song</span></div><div class="ytmusicTrackInfoByline"><span><a role="button">Modern artist</a> • <a role="button">Modern album</a> • 2026</span></div>';
        const empty=document.createElement('ytmusic-track-info');empty.hidden=true;old.before(empty);old.replaceWith(modern);
        document.querySelector('#cover').src='https://lh3.googleusercontent.com/modern-cover=w544-h544-l90-rj';
      });
      await youtube.locator('#sparunkify-launcher button').click();
      await youtube.waitForFunction(()=>document.querySelector('#sparunkify-room').shadowRoot.querySelector('#title').textContent==='Modern player song');
      await youtube.locator('#sparunkify-room .sleeve.ready').waitFor();
      assert.equal(await youtube.locator('#sparunkify-room #artist').textContent(),'Modern artist');
      await youtube.evaluate(()=>document.querySelector('.ytmusicTrackInfoTitle span').textContent='Next modern song');
      await youtube.waitForFunction(()=>document.querySelector('#sparunkify-room').shadowRoot.querySelector('#title').textContent==='Next modern song');
      await youtube.screenshot({path:path.join(out,'youtube-music-modern.png')});
      await youtube.locator('#sparunkify-room #close').click();
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:true,maxwell:true}}));
      await youtube.locator('#sparunkify-maxwell canvas').waitFor();
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:true,maxwell:false}}));
      await youtube.locator('#sparunkify-maxwell').waitFor({state:'detached'});assert.deepEqual(integrationErrors,[]);
    }finally{await extension.close();}
    console.log('Player browser QA passed: Spotify and YouTube Music fixtures, artwork identity and track changes, below-artwork placement, expanded view, hidden covers, toggle cleanup, real audio analysis, mobile and WebGL assets.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
