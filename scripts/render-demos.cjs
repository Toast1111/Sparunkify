// Render historical/current engines in an isolated browser. Never edit engine.js.
const {chromium}=require(process.argv[2]||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
  const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','demo-frames');
  const production=fs.readFileSync(path.join(root,'engine.js'),'utf8');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const sourcePage=await browser.newPage();
    await sourcePage.goto(pathToFileURL(path.join(root,'preview.html')).href);
    await sourcePage.locator('.sleeve.ready').waitFor();
    const image=await sourcePage.locator('.sleeve img').getAttribute('src');
    await sourcePage.close();
    for(const [name,code] of [['before',fs.readFileSync(path.join(root,'tests/fixtures/engine-v0.1.7.js'),'utf8')],['after',production]]){
      const dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});
      const page=await browser.newPage({viewport:{width:600,height:600},deviceScaleFactor:1});
      await page.evaluate(async({code,image})=>{
        (0,eval)(code);
        const art=new Image();art.src=image;await art.decode();
        const canvas=document.createElement('canvas');canvas.style.cssText='width:480px;height:480px';document.body.append(canvas);
        globalThis.demoRenderer=new Sparunkify.Renderer(canvas,{...Sparunkify.defaults,motion:false,sparkle:0});
        demoRenderer.setImage(art);cancelAnimationFrame(demoRenderer.frame);demoRenderer.active=false;
      },{code,image});
      for(let frame=0;frame<60;frame++){
        const png=await page.evaluate(frame=>{
          const renderer=demoRenderer,phase=frame/60*Math.PI*2;
          renderer.pointer=[Math.cos(phase)*.85,Math.sin(phase)*.65];renderer.target=renderer.pointer.slice();
          renderer.time=2;renderer.last=0;renderer.active=true;renderer.tick(1000);cancelAnimationFrame(renderer.frame);renderer.active=false;
          const gl=renderer.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,raw=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,raw);
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(w,h);
          for(let y=0;y<h;y++)pixels.data.set(raw.subarray(y*w*4,(y+1)*w*4),(h-y-1)*w*4);ctx.putImageData(pixels,0,0);
          if(gl.getError())throw Error('GPU capture failed');
          return canvas.toDataURL('image/png').split(',')[1];
        },frame);
        fs.writeFileSync(path.join(dir,String(frame).padStart(3,'0')+'.png'),Buffer.from(png,'base64'));
      }
      await page.close();console.log(`Rendered ${name}: 60 frames`);
    }
    assert.equal(fs.readFileSync(path.join(root,'engine.js'),'utf8'),production);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
