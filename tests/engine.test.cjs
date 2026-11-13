const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../engine.js'),'utf8'),scope);const S=scope.Sparunkify;
const artworkCode=fs.readFileSync(require('node:path').join(__dirname,'../artwork.js'),'utf8');
const artScope={URL};vm.runInNewContext(artworkCode,artScope);const A=artScope.SparunkifyArtwork;
const albumID='ff9ca10b55ce82ae553c8228',cover=code=>`https://i.scdn.co/image/ab67616d0000${code}${albumID}`;
test('album theme favors prominent color over white margins and keeps grayscale neutral',()=>{
  const pixels=new Uint8Array(100*4);
  for(let i=0;i<100;i++)pixels.set(i<60?[255,255,255,255]:[210,30,70,255],i*4);
  const rgb=S.albumColor(pixels).split(',').map(Number);
  assert.ok(rgb[0]>rgb[1]*3&&rgb[0]>rgb[2]*2);
  assert.equal(rgb[0],210,'Artwork fallback must retain the source color intensity');
  pixels.fill(120);
  assert.equal(S.albumColor(pixels),'120, 120, 120');
  pixels.fill(0);
  assert.equal(S.albumColor(pixels),'18, 18, 18');
});
test('thumbnail and large cover share identity, with full-size first and thumbnail last',()=>{
  assert.equal(A.key(cover('4851')),A.key(cover('82c1')));
  assert.deepEqual(Array.from(A.candidates(cover('4851'))),[cover('82c1'),cover('b273'),cover('4851')]);
  assert.notEqual(A.key(cover('4851')),A.key(cover('4851').replace(albumID,'a'.repeat(24))));
  const mosaic='https://mosaic.scdn.co/640/abcd';assert.deepEqual(Array.from(A.candidates(mosaic)),[mosaic]);
});
test('best source selects matching srcset detail instead of unrelated larger covers',()=>{
  assert.equal(A.bestSource(cover('4851'),[
    {src:cover('4851'),naturalWidth:64,srcset:`${cover('1e02')} 300w, ${cover('b273')} 640w`},
    {src:cover('82c1').replace(albumID,'b'.repeat(24)),naturalWidth:2000}
  ]),cover('b273'));
});
test('worker falls back when the large variant is missing and uses credential-free requests',async()=>{
  let listener;const requested=[];
  const sandbox={URL,AbortSignal,Uint8Array,btoa:value=>Buffer.from(value,'binary').toString('base64'),chrome:{runtime:{onMessage:{addListener:fn=>listener=fn}}},fetch:async(url,options)=>{
    requested.push(url);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    return url===cover('82c1')?{ok:false,status:404}:{ok:true,headers:{get:()=> 'image/jpeg'},arrayBuffer:async()=>new Uint8Array([255,216,255]).buffer};
  }};
  vm.createContext(sandbox);sandbox.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),sandbox);};
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8'),sandbox);
  const result=await new Promise(resolve=>listener({type:'artwork',url:cover('4851')},{tab:{url:'https://open.spotify.com/'}},resolve));
  assert.deepEqual(requested,[cover('82c1'),cover('b273')]);assert.equal(result.url,cover('b273'));assert.match(result.data,/^data:image\/jpeg;base64,/);
});
test('WebGL receives the original 2000px image while surface maps remain 512px',()=>{
  const uploads=[],canvases=[];
  const gl=new Proxy({texImage2D:(...args)=>uploads.push(args)},{get:(target,key)=>target[key]||(()=>{})});
  const sandbox={document:{createElement:()=>{const c={getContext:()=>({drawImage:()=>{},getImageData:()=>({data:new Uint8Array(c.width*c.height*4).fill(128)})})};canvases.push(c);return c;}}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../engine.js'),'utf8'),sandbox);
  const image={naturalWidth:2000,naturalHeight:2000};
  const renderer={gl,maxTextureSize:4096,textures:[],uniforms:{}};
  sandbox.Sparunkify.Renderer.prototype.setImage.call(renderer,image);
  assert.equal(uploads[0].at(-1),image,'Color must never be uploaded from the 512px inference canvas');
  assert.equal(canvases[0].width,512);assert.equal(uploads[1][3],512);assert.equal(uploads[2][4],512);
  assert.equal(renderer.ready,true);
});
test('flat artwork produces flat normals and uniform material',()=>{const rgba=new Uint8Array(8*8*4).fill(128),maps=S.deriveMaps(rgba,8,8);for(let i=0;i<64;i++){assert.equal(maps.normal[i*4],127);assert.equal(maps.normal[i*4+1],127);assert.equal(maps.normal[i*4+2],255);assert.equal(maps.material[i*4],maps.material[0]);}});
test('height smoothing suppresses isolated image spikes while keeping broad brightness relief',()=>{
  const pixels=new Uint8Array(9*9*4),center=4*9+4;
  pixels.set([255,255,255,255],center*4);
  const {heights,material}=S.deriveMaps(pixels,9,9);
  assert.ok(heights[center]<.4,'A single bright pixel should not make a full-height spike');
  assert.ok(heights[center]>heights[center+1]);assert.ok(heights[center+1]>heights[0]);
  assert.ok(Math.abs(material[center*4]/255-heights[center])<1/255);
});
test('maximum saved depth keeps parallax below one CSS pixel and renders a continuous quad',()=>{
  const uniforms={},draws=[];
  const sandbox={document:{hidden:false},requestAnimationFrame:()=>1,matchMedia:()=>({matches:false}),devicePixelRatio:2};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../engine.js'),'utf8'),sandbox);
  const gl={useProgram:()=>{},uniform1f:(key,value)=>uniforms[key]=value,uniform2f:()=>{},viewport:()=>{},drawArrays:(...args)=>draws.push(args),TRIANGLES:4};
  const renderer={gl,settings:{...S.defaults,depth:100},ready:true,active:true,last:0,time:0,pointer:[1,-1],target:[1,-1],canvas:{width:1360,height:1360,clientWidth:680},maxRenderSize:2048,uniforms:new Proxy({},{get:(_,key)=>key})};
  sandbox.Sparunkify.Renderer.prototype.tick.call(renderer,100);
  assert.deepEqual(draws,[[4,0,6]]);
  assert.equal(uniforms.depth,1);
  assert.ok(.5*uniforms.depth*uniforms.displacementLimit*renderer.canvas.clientWidth<=1);
  renderer.canvas.clientWidth=320;renderer.last=0;
  sandbox.Sparunkify.Renderer.prototype.tick.call(renderer,100);
  assert.ok(.5*uniforms.depth*uniforms.displacementLimit*320<=1);
});
test('Sobel normals follow horizontal brightness changes without a vertical slope',()=>{const rgba=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++)rgba.set([x*17,x*17,x*17,255],(y*16+x)*4);const {normal,heights}=S.deriveMaps(rgba,16,16),offset=(8*16+8)*4;assert.ok(normal[offset]<127);assert.equal(normal[offset+1],127);assert.ok(heights[8*16+12]>heights[8*16+3]);});
test('high contrast and single-pixel images produce finite, bounded map values',()=>{for(const n of [1,2,17]){const rgba=new Uint8Array(n*n*4);for(let i=0;i<rgba.length;i++)rgba[i]=i%3?255:0;const maps=S.deriveMaps(rgba,n,n);assert.equal(maps.normal.length,n*n*4);for(const h of maps.heights)assert.ok(Number.isFinite(h)&&h>=0&&h<=1);}});
test('settings reject malformed data and clamp GPU parameters',()=>{const settings=S.normalize({depth:200,shine:-20,roughness:NaN,preset:'unknown',enabled:'false',motion:false,arbitrary:3});assert.equal(settings.depth,100);assert.equal(settings.shine,0);assert.equal(settings.roughness,S.defaults.roughness);assert.equal(settings.preset,'foil');assert.equal(settings.enabled,true);assert.equal(settings.motion,false);assert.equal(settings.arbitrary,undefined);});
test('artwork proxy rejects unknown hosts, unsupported pages and cross-service requests',async()=>{
  let listener,calls=0;
  const sandbox={chrome:{runtime:{onMessage:{addListener:fn=>listener=fn}}},URL,AbortSignal,fetch:()=>{calls++;throw Error('Should not fetch');}};
  vm.createContext(sandbox);sandbox.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),sandbox);};
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8'),sandbox);
  for(const [url,page] of [
    ['https://evil.example/image','https://open.spotify.com/'],
    ['https://i.scdn.co/image/abc','https://evil.example/'],
    ['https://lh3.googleusercontent.com/cover=w500','https://open.spotify.com/'],
    ['https://i.scdn.co/image/abc','https://music.youtube.com/'],
    ['https://lh3.googleusercontent.com.evil.example/cover','https://music.youtube.com/'],
    ['https://i.scdn.co/image/abc','https://open.spotify.com.evil.example/']
  ]){const result=await new Promise(resolve=>listener({type:'artwork',url},{tab:{url:page}},resolve));assert.ok(result.error);}
  assert.equal(calls,0);
});
