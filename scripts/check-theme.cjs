// Optional real-browser checks for native background extraction and rendering.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
  fs.mkdirSync(path.resolve(__dirname,'../artifacts/ui-qa'),{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://i.scdn.co/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64')}));
    const url='https://i.scdn.co/image/ab67616d0000b2730123456789abcdef01234567';
    await page.setContent(`<style>body{margin:0;background:#121212}#native{position:relative;width:1000px;height:900px;background:linear-gradient(transparent,rgba(0,0,0,.18)),rgb(32,70,120);display:grid;place-items:center}img{width:400px;height:400px}</style><section id="native"><div><img src="${url}"></div></section>`);
    for(const file of ['artwork.js','engine.js','spotify-theme.js','surface.js'])await page.addScriptTag({path:path.resolve(__dirname,'..',file)});
    const theme=await page.evaluate(url=>Sparunkify.readSpotifyTheme(url),url);
    assert.equal(theme.color,'rgb(32, 70, 120)');
    const sourceImage=await page.locator('#native').evaluate(el=>getComputedStyle(el).backgroundImage);
    assert.equal(theme.image,sourceImage,'Native gradient stops and alpha must be copied without dimming');
    assert.equal(await page.evaluate(url=>Sparunkify.readSpotifyTheme(url.replace('01234567','bbbbbbbb')),url),null,'Unrelated album backgrounds must be ignored');
    await page.evaluate(()=>document.getElementById('native').style.display='none');
    assert.equal(await page.evaluate(url=>Sparunkify.readSpotifyTheme(url),url),null,'Hidden artwork must not provide a stale theme');
    await page.evaluate(()=>{const node=document.getElementById('native');node.style.display='grid';node.style.backgroundColor='rgb(110,25,65)';});
    assert.equal((await page.evaluate(url=>Sparunkify.readSpotifyTheme(url),url)).color,'rgb(110, 25, 65)','Native theme updates must be detected');
    await page.addStyleTag({content:'#native::before{content:"";position:absolute;inset:0;background:linear-gradient(transparent,rgba(0,0,0,.12));pointer-events:none}'});
    assert.ok((await page.evaluate(url=>Sparunkify.readSpotifyTheme(url),url)).image.includes('0.12'),'Full-size native fade layers must be retained');
    await page.evaluate(async theme=>{
      const surface=globalThis.qaSurface=Sparunkify.createSurface({settings:Sparunkify.defaults});
      surface.setTheme(theme);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#294c80';ctx.fillRect(0,0,64,64);
      const image=new Image();image.src=canvas.toDataURL();await image.decode();surface.setImage(image);
    },theme);
    assert.equal(await page.locator('.room').evaluate(el=>getComputedStyle(el).backgroundColor),theme.color);
    assert.equal(await page.locator('.room').evaluate(el=>getComputedStyle(el).backgroundImage),theme.image,'Artwork load must not replace the Spotify theme');
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/ui-qa/spotify-background.png')});
    await page.evaluate(()=>qaSurface.setTheme(null));
    assert.equal(await page.locator('.room').getAttribute('data-theme-source'),'artwork');
    assert.equal(await page.locator('.room').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(41, 76, 128)','Fallback must retain the artwork intensity');
    await page.evaluate(()=>qaSurface.destroy());
    await page.addStyleTag({content:'#native::before{content:none}'});
    await page.evaluate(()=>{
      const native=document.getElementById('native');native.style.background='transparent';
      const backdrop=document.createElement('div');backdrop.style.cssText='position:absolute;inset:0;background:rgb(32,70,120)';native.prepend(backdrop);
    });
    assert.ok((await page.evaluate(url=>Sparunkify.readSpotifyTheme(url),url)).image.includes('rgb(32, 70, 120)'),'Separate native backdrop elements must be read');
    assert.deepEqual(errors,[]);
    console.log('Chrome fixtures: native color/gradient, album matching, hidden source rejection, theme changes, fade layers, image loading and full-strength fallback passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
