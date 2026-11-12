// Render promotional assets from the actual extension and original fictional art.
// node scripts/build-store-assets.cjs <playwright module> [Chromium executable]
const {chromium}=require(process.argv[2]||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'docs/store'),scratch=path.join(root,'artifacts/store');
fs.mkdirSync(scratch,{recursive:true});
const cover=fs.readFileSync(path.join(output,'source/afterglow-cover.png'));
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.css':'text/css'};
const uri=bytes=>'data:image/png;base64,'+bytes.toString('base64');
const original=uri(cover),icon=uri(fs.readFileSync(path.join(root,'icons/icon-128.png')));
const brand=`<div class="brand"><img src="${icon}">Sparunkify</div>`;
const credit='Fictional demo artwork · Maxwell model: bean(alwayshasbean), CC BY 4.0 · adapted';
const stylesheet=`*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Arial,sans-serif;color:#f8f4ff;background:radial-gradient(ellipse at 90% 20%,#242240 0,transparent 58%),radial-gradient(ellipse at 20% 100%,#142b35 0,transparent 65%),#10121b}.brand{position:absolute;left:58px;top:42px;display:flex;gap:13px;align-items:center;font-size:24px;font-weight:bold;letter-spacing:-.7px}.brand img{width:34px;height:34px}.eyebrow{font:11px monospace;letter-spacing:2px;color:#c2acf2;margin-bottom:24px}.copy{position:absolute;left:60px;top:210px;width:540px}h1{font-size:64px;line-height:1.04;letter-spacing:-3px;margin:0 0 28px}h1 em{font-style:normal;color:#c6b4ff}.description{font-size:18px;line-height:1.65;max-width:390px;color:#bfc1d1}.pills{display:flex;gap:10px;margin-top:35px}.pills span{font:10px monospace;letter-spacing:1px;border:1px solid #565169;border-radius:30px;padding:10px 14px;color:#ddd2f3}.foot{position:absolute;left:60px;right:50px;bottom:26px;font:10px monospace;color:#9698ac;letter-spacing:.3px}.topnote{position:absolute;right:60px;top:55px;font:10px monospace;letter-spacing:2px;color:#9896ae}.art{position:absolute;width:475px;height:475px;left:735px;top:172px;transform:rotate(-6deg);border:1px solid #ffffff35;border-radius:5px;box-shadow:0 30px 80px #0009}.number{position:absolute;left:60px;bottom:72px;font:11px monospace;color:#b9abc9;letter-spacing:1px}.panel-shot{position:absolute;object-fit:contain;border:1px solid #ffffff26;border-radius:12px;box-shadow:0 20px 65px #0008}.notes{margin:35px 0;padding:0;list-style:none;color:#c5c2d5;font-size:16px;line-height:2.2}.notes li:before{content:'↗';color:#c6b4ff;margin-right:13px}`;
function pageHTML(body,extra=''){return `<!doctype html><html lang="en"><meta charset="utf-8"><style>${stylesheet}${extra}</style><body>${body}</body></html>`;}
(async()=>{
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[];
  try{
    const capture=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:2});capture.on('pageerror',err=>errors.push(err.message));
    await capture.goto(base+'/preview.html');await capture.locator('.sleeve.ready').waitFor();
    await capture.locator('#file').setInputFiles({name:'Afterglow.png',mimeType:'image/png',buffer:cover});
    await capture.waitForFunction(([width,height])=>{const image=document.getElementById('sparunkify-room').shadowRoot.querySelector('.sleeve img');return image.src.startsWith('blob:')&&image.naturalWidth===width&&image.naturalHeight===height;},[cover.readUInt32BE(16),cover.readUInt32BE(20)]);
    await capture.mouse.move(545,285);await capture.waitForTimeout(250);
    const effects=await capture.locator('.sleeve').screenshot({path:path.join(scratch,'cover-effects.png')}),effectImage=uri(effects);
    await capture.setViewportSize({width:1280,height:800});await capture.locator('#tune').click();await capture.mouse.move(0,0);await capture.waitForTimeout(250);
    await capture.screenshot({path:path.join(output,'04-finish-settings.png'),scale:'css',omitBackground:false});
    console.log('04-finish-settings.png: 1280 × 800, direct interface capture');
    // Actual extension content scripts mounted in a clearly labeled local fixture.
    const extension=await chromium.launchPersistentContext(path.join(scratch,'profile'),{executablePath:process.argv[3]||chromium.executablePath(),headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:600,height:820},deviceScaleFactor:2});
    let sidebar;
    try{
      const worker=extension.serviceWorkers()[0]||await extension.waitForEvent('serviceworker');
      await worker.evaluate(data=>{globalThis.fetch=async()=>new Response(Uint8Array.from(atob(data),c=>c.charCodeAt(0)),{headers:{'content-type':'image/png'}});},cover.toString('base64'));
      const url='https://i.scdn.co/image/ab67616d0000b273ff9ca10b55ce82ae553c8228';
      await extension.route('https://i.scdn.co/**',route=>route.fulfill({contentType:'image/png',body:cover}));
      await extension.route('https://open.spotify.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Sidebar demonstration</title><style>*{box-sizing:border-box}body{margin:0;background:#15151d;color:#fff;font-family:Arial,sans-serif}aside{width:334px;padding:16px;background:#111;border-radius:10px}header{font-size:14px;font-weight:bold;margin:0 0 16px}#cover-wrap{width:302px;height:302px;border-radius:6px;overflow:hidden}#cover{display:block;width:302px;height:302px}h1{font-size:23px;line-height:1.2;margin:8px 0 5px}.artist{color:#aaa;font-size:14px;margin:0}.demo{font:9px monospace;letter-spacing:1px;color:#8d8999;margin:20px 0 6px}footer{position:fixed;bottom:0;left:400px;height:90px}</style><aside id="sidebar"><header>Now Playing</header><div id="cover-wrap"><img id="cover" src="${url}" alt="Afterglow fictional album cover"></div><h1>Afterglow</h1><p class="artist">Sparunkify Sessions</p><p class="demo">SIDEBAR DEMO · FICTIONAL TRACK</p></aside><footer data-testid="now-playing-widget"><img src="${url}" width="60" height="60"><a data-testid="nowplaying-track-link">Afterglow</a></footer>`}));
      await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,inline:true,maxwell:true,motion:false}}));
      const tab=await extension.newPage();tab.on('pageerror',err=>errors.push(err.message));await tab.goto('https://open.spotify.com/');
      await tab.locator('#sparunkify-maxwell canvas').waitFor();await tab.waitForTimeout(250);
      const art=await tab.locator('#cover').boundingBox(),cat=await tab.locator('#sparunkify-maxwell').boundingBox();assert.ok(cat.y>=art.y+art.height);
      // The fixed artwork overlay and real cat render are captured together.
      const box=await tab.locator('#sidebar').boundingBox();
      sidebar=await tab.screenshot({path:path.join(scratch,'sidebar.png'),clip:box});
    }finally{await extension.close();}
    const sidebarImage=uri(sidebar);
    const canvasPage=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});canvasPage.on('pageerror',err=>errors.push(err.message));
    async function render(name,body,css='',width=1280,height=800){
      await canvasPage.setViewportSize({width,height});await canvasPage.setContent(pageHTML(body,css));
      await canvasPage.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode()));await document.fonts.ready;});
      await canvasPage.screenshot({path:path.join(output,name),omitBackground:false});console.log(`${name}: ${width} × ${height}`);
    }
    await render('01-artwork-effects.png',`${brand}<div class="topnote">ARTWORK EFFECTS FOR SPOTIFY WEB PLAYER</div><div class="copy"><div class="eyebrow">YOUR MUSIC, WITH A FINISH.</div><h1>A little depth.<br>A little light.<br><em>A lot of detail.</em></h1><p class="description">Reflective artwork finishes, right in the player.</p><div class="pills"><span>FOIL</span><span>GLOSS</span><span>EMBOSSED</span></div></div><img class="art" src="${effectImage}"><div class="number">01 / ORIGINAL FICTIONAL ALBUM ARTWORK</div><div class="foot">Demo artwork · Actual Sparunkify renderer output · No real artist or release depicted</div>`);
    await render('02-sidebar-maxwell.png',`${brand}<div class="copy" style="top:203px"><div class="eyebrow">PART OF YOUR LISTENING SPACE.</div><h1>Made for<br><em>your sidebar.</em></h1><p class="description">Keep browsing. Your artwork keeps its finish. Maxwell gets his own spot below.</p><ul class="notes"><li>Effects on the album cover</li><li>Optional music-reactive cat</li><li>Track details stay visible</li></ul></div><img class="panel-shot" src="${sidebarImage}" style="height:694px;width:auto;right:130px;top:40px"><div class="foot">Sidebar layout demonstration · Actual extension rendering · ${credit}</div>`);
    await render('03-original-vs-effects.png',`${brand}<div class="topnote">SAME ARTWORK. YOUR CHOICE OF FINISH.</div><h1 style="position:absolute;top:116px;left:60px;font-size:43px;letter-spacing:-1.5px">Keep the art. <em>Add the finish.</em></h1><div class="compare"><figure><img src="${original}"><figcaption>ORIGINAL</figcaption></figure><figure><img src="${effectImage}"><figcaption>FOIL FINISH · ACTUAL RENDERER OUTPUT</figcaption></figure></div><div class="foot">Original fictional album cover · Identical source artwork in both views</div>`,`.compare{position:absolute;left:155px;top:214px;display:flex;gap:62px}.compare figure{margin:0}.compare img{width:450px;height:450px;border-radius:6px;border:1px solid #ffffff25;box-shadow:0 20px 60px #0006}.compare figcaption{font:11px monospace;letter-spacing:1.5px;color:#c7badc;margin-top:21px;text-align:center}`);
    await render('small-promo-440x280.png',`${brand}<h1 style="position:absolute;left:24px;top:91px;font-size:31px;letter-spacing:-1px;line-height:1.12">Art with<br><em>a little extra.</em></h1><p style="position:absolute;left:24px;top:178px;font-size:11px;line-height:1.6;color:#bbb6cc">Artwork effects.<br>One music-reactive cat.</p><img src="${effectImage}" style="position:absolute;width:172px;right:-6px;top:56px;transform:rotate(9deg);border-radius:4px;border:1px solid #ffffff40;box-shadow:0 20px 40px #000a"><div style="position:absolute;left:24px;bottom:13px;font:8px monospace;color:#8f8ca0">FICTIONAL DEMO ARTWORK</div>`,`.brand{left:24px;top:23px;font-size:19px;gap:9px}.brand img{width:25px;height:25px}`,440,280);
    await render('marquee-1400x560.png',`${brand}<div class="copy" style="top:155px"><div class="eyebrow">SPOTIFY WEB PLAYER, WITH A FINISH.</div><h1 style="font-size:66px">Let your<br><em>artwork shine.</em></h1><p class="description">Reflective finishes. Local settings.<br>Optional Maxwell, below the cover.</p></div><img class="art" src="${effectImage}" style="width:390px;height:390px;left:845px;top:85px;transform:rotate(7deg)"><div class="foot">Sparunkify · Original fictional album artwork · Actual renderer output</div>`,'.brand{top:35px}',1400,560);
    fs.copyFileSync(path.join(root,'icons/icon-128.png'),path.join(output,'store-icon-128.png'));
    assert.deepEqual(errors,[]);console.log('Store graphics rendered successfully.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});
