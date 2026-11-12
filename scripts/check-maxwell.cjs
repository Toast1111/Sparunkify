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
    const extension=await chromium.launchPersistentContext(path.join(out,'extension-profile'),{executablePath:process.argv[3]||chromium.executablePath(),headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1100,height:950}});
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
    }finally{await extension.close();}
    console.log('Maxwell browser QA passed: below-artwork placement in normal Spotify and Artwork view, track details kept clear, toggle cleanup, real audio analysis, mobile and WebGL assets.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
