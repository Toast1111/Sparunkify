const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=file=>fs.readFileSync(path.join(root,file),'utf8');
const context={URL};vm.createContext(context);
for(const file of ['players.js','artwork.js'])vm.runInContext(code(file),context);
const P=context.SparunkifyPlayers,A=context.SparunkifyArtwork;

test('player detection accepts only the exact supported origins',()=>{
  assert.equal(P.player('https://music.youtube.com/watch?v=abc').name,'YouTube Music');
  assert.equal(P.player('https://open.spotify.com/track/abc').name,'Spotify');
  for(const url of ['http://music.youtube.com/','https://www.youtube.com/','https://music.youtube.com.evil.example/','https://music.youtube.com:444/','invalid'])assert.equal(P.player(url),null);
});
test('YouTube cover sizes share identity and the largest observed cover wins',()=>{
  const small='https://lh3.googleusercontent.com/album-one=w60-h60-l90-rj',large='https://lh3.googleusercontent.com/album-one=w544-h544-l90-rj';
  assert.equal(A.key(small),A.key(large));assert.notEqual(A.key(small),A.key(small.replace('one','two')));
  assert.equal(A.bestSource(small,[{src:large},{src:large.replace('one','two'),naturalWidth:2000}]),large);
  assert.deepEqual(Array.from(A.candidates(large)),[large],'Use the observed image URL instead of guessing authenticated CDN variants');
  assert.equal(A.key('https://i.ytimg.com/vi/video123/hqdefault.jpg'),A.key('https://i.ytimg.com/vi_webp/video123/maxresdefault.webp'));
  assert.notEqual(A.key('https://i.ytimg.com/vi/video123/hqdefault.jpg'),A.key('https://i.ytimg.com/vi/another/hqdefault.jpg'));
});
test('YouTube artwork proxy preserves the original query and fetches without credentials',async()=>{
  const url='https://lh3.googleusercontent.com/album-one=w544-h544-l90-rj?token=demo';let listener;
  const sandbox={URL,AbortSignal,Uint8Array,btoa:value=>Buffer.from(value,'binary').toString('base64'),chrome:{runtime:{onMessage:{addListener:fn=>listener=fn}}},fetch:async(value,options)=>{
    assert.equal(value,url);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    return {ok:true,headers:{get:()=> 'image/webp'},arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
  }};
  vm.createContext(sandbox);sandbox.importScripts=(...files)=>{for(const file of files)vm.runInContext(code(file),sandbox);};
  vm.runInContext(code('background.js'),sandbox);
  const result=await new Promise(resolve=>listener({type:'artwork',url},{tab:{url:'https://music.youtube.com/'}},resolve));
  assert.equal(result.url,url);assert.match(result.data,/^data:image\/webp;base64,/);
});

async function popup(tabs,active){
  const nodes=new Map(),requests=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:0,hidden:true,addEventListener:(event,fn)=>node(id)[event]=fn});return nodes.get(id);};
  const sandbox={URL,setTimeout,clearTimeout,document:{getElementById:node},window:{close:()=>{}},chrome:{
    storage:{local:{get:async()=>({}),set:async()=>{}}},
    tabs:{query:async query=>query.active?[active].filter(Boolean):tabs,sendMessage:async id=>{requests.push(id);return {detected:true,title:'Test song'};},create:async()=>{}}
  }};
  vm.createContext(sandbox);for(const file of ['players.js','engine.js','popup.js'])vm.runInContext(code(file),sandbox);
  await new Promise(setImmediate);
  return {nodes,requests};
}
test('popup automatically chooses the current player over another audible tab',async()=>{
  const spotify={id:1,url:'https://open.spotify.com/',audible:true},youtube={id:2,url:'https://music.youtube.com/'};
  const app=await popup([spotify,youtube],youtube);
  assert.deepEqual(app.requests,[2]);assert.equal(app.nodes.get('status').textContent,'YouTube Music · Test song');
});
test('popup prefers an audible player when opened elsewhere and offers both players when none is open',async()=>{
  const app=await popup([{id:1,url:'https://open.spotify.com/',lastAccessed:100},{id:2,url:'https://music.youtube.com/',audible:true}],{id:3,url:'https://example.com/'});
  assert.deepEqual(app.requests,[2]);
  const empty=await popup([],{id:3,url:'https://example.com/'});
  assert.equal(empty.nodes.get('players').hidden,false);assert.match(empty.nodes.get('status').textContent,/automatically/);
});
