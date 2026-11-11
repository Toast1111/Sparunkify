// Optional browser QA: node scripts/check-ui.cjs <path to playwright module>
// Uses a separate headless Chrome session; popup Chrome APIs are stubbed.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
  const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','ui-qa');
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root,'preview.html')).href);
    await page.locator('.sleeve.ready').waitFor();
    assert.equal(await page.locator('#source').textContent(),'Image preview');
    await page.screenshot({path:path.join(out,'artwork.png')});
    await page.locator('#tune').click();
    assert.equal(await page.locator('#tune').getAttribute('aria-expanded'),'true');
    const art=await page.locator('.stage').boundingBox(),panel=await page.locator('.panel').boundingBox();
    assert.ok(art.x+art.width<panel.x,'Settings must not cover the artwork');
    await page.screenshot({path:path.join(out,'settings.png')});
    await page.locator('#compare').click();
    assert.equal(await page.locator('.under-art').textContent(),'Original');
    await page.locator('#depth').fill('62');
    assert.equal(await page.locator('.under-art').textContent(),'Effects on');
    assert.equal(await page.locator('output[for=depth]').textContent(),'62%');
    await page.locator('[data-preset=gloss]').click();
    assert.equal(await page.locator('#depth').inputValue(),'22');
    await page.locator('#displacement').click();
    assert.equal(await page.locator('canvas').getAttribute('aria-label'),'Generated grayscale displacement map');
    await page.locator('#displacement').click();
    assert.equal(await page.locator('.under-art').textContent(),'Effects on');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tune').getAttribute('aria-expanded'),'false');
    await page.setViewportSize({width:390,height:844});
    await page.locator('#tune').click();
    assert.ok(await page.locator('.room').evaluate(el=>el.scrollWidth<=el.clientWidth),'Narrow layout must fit without horizontal scroll');
    const main=await page.locator('main').boundingBox(),narrowPanel=await page.locator('.panel').boundingBox();
    assert.ok(narrowPanel.y>=main.y+main.height-1,'Narrow settings must sit below artwork');
    await page.screenshot({path:path.join(out,'narrow-artwork.png')});
    await page.locator('#reset').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'narrow-settings.png')});
    // Artwork changes must refresh the page theme, not just the cover texture.
    for(const [name,color,channel] of [['red','#d21e46',0],['blue','#284ed2',2]]){
      const data=await page.evaluate(color=>{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
        const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,64,64);
        return canvas.toDataURL().split(',')[1];
      },color);
      await page.locator('#file').setInputFiles({name:name+'.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
      await page.waitForFunction(channel=>{
        const theme=document.getElementById('sparunkify-room').style.getPropertyValue('--album-color').split(',').map(Number);
        return theme[channel]>theme[channel===0?2:0]*2;
      },channel);
    }
    const popup=await browser.newPage({viewport:{width:320,height:720}});
    popup.on('pageerror',error=>errors.push(error.message));
    await popup.addInitScript(()=>{
      globalThis.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},tabs:{query:async()=>[]}};
    });
    await popup.goto(pathToFileURL(path.join(root,'popup.html')).href);
    await popup.locator('#preset').selectOption('embossed');
    assert.equal(await popup.locator('#depth').inputValue(),'76');
    await popup.locator('#enabled').uncheck();
    assert.equal(await popup.locator('#enabled').isChecked(),false);
    assert.ok(await popup.evaluate(()=>document.documentElement.scrollWidth<=320));
    await popup.screenshot({path:path.join(out,'popup.png')});
    assert.deepEqual(errors,[]);
    console.log('Headless Chrome: artwork renderer, view modes, settings, presets, narrow layout and stubbed popup passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
