const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const engine=fs.readFileSync(path.join(__dirname,'../engine.js'),'utf8');
const content=fs.readFileSync(path.join(__dirname,'../content.js'),'utf8');

async function setup({set=async()=>{},get=async()=>({})}={}){
  const timeouts=new Map(),intervals=new Map(),windowEvents={},buttonEvents={},statuses=[],writes=[];
  let nextID=0,observerDisconnected=false,reloads=0,surfaceOptions;
  const button={addEventListener:(name,fn)=>buttonEvents[name]=fn,focus:()=>{},textContent:'Bedazzle'};
  const shadow={querySelector:()=>button};
  const launcher={attachShadow:()=>shadow,contains:()=>false,hidden:false};
  const sandbox={
    document:{body:{append:()=>{}},getElementById:()=>null,createElement:()=>launcher,querySelector:()=>null,addEventListener:()=>{}},
    window:{addEventListener:(name,fn)=>windowEvents[name]=fn},
    URL,location:{href:'https://open.spotify.com/',reload:()=>reloads++},
    setTimeout:(fn,delay)=>{const id=++nextID;timeouts.set(id,{fn,delay});return id;},
    clearTimeout:id=>timeouts.delete(id),
    setInterval:fn=>{const id=++nextID;intervals.set(id,fn);return id;},
    clearInterval:id=>intervals.delete(id),
    MutationObserver:class{observe(){}disconnect(){observerDisconnected=true;}},
    chrome:{
      storage:{local:{get,set:value=>{writes.push(value);return set(value);}},onChanged:{addListener:()=>{}}},
      runtime:{id:'test-extension',onMessage:{addListener:()=>{}}}
    }
  };
  vm.createContext(sandbox);vm.runInContext(engine,sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../players.js'),'utf8'),sandbox);
  sandbox.Sparunkify.createSurface=options=>{
    surfaceOptions=options;
    return {root:{querySelector:()=>button},setStatus:text=>statuses.push(text),update:()=>{},destroy:()=>{}};
  };
  vm.runInContext(content,sandbox);
  await Promise.resolve();await Promise.resolve();
  return {
    sandbox,timeouts,intervals,statuses,writes,button,
    open:()=>buttonEvents.click(),
    close:()=>surfaceOptions.onClose(),
    change:patch=>surfaceOptions.onSettings({...sandbox.Sparunkify.defaults,...patch}),
    pagehide:()=>windowEvents.pagehide(),
    async runSave(){
      const entry=[...timeouts].find(([,task])=>task.delay===180);
      assert.ok(entry,'Expected a debounced settings save');
      timeouts.delete(entry[0]);await entry[1].fn();
    },
    get disconnected(){return observerDisconnected;},
    get reloads(){return reloads;}
  };
}

test('debounced save catches a synchronous context-invalidated throw and stops retries',async()=>{
  const app=await setup({set:()=>{throw new Error('Extension context invalidated.');}});
  app.open();app.change({depth:75});
  await assert.doesNotReject(()=>app.runSave());
  assert.equal(app.writes.length,1);
  assert.match(app.statuses.at(-1),/Refresh this Spotify tab/);
  assert.equal(app.button.textContent,'Refresh Spotify');
  assert.equal(app.intervals.size,0);assert.equal(app.timeouts.size,0);assert.equal(app.disconnected,true);
  app.change({depth:80});assert.equal(app.timeouts.size,0);
  assert.equal(app.reloads,0,'Recovery must not reload the page automatically');
  app.close();app.open();assert.equal(app.reloads,1,'The user can explicitly click Refresh Spotify');
});

test('debounced save also handles a rejected context-invalidated promise',async()=>{
  const app=await setup({set:()=>Promise.reject(new Error('Extension context invalidated.'))});
  app.open();app.change({shine:85});await app.runSave();
  assert.match(app.statuses.at(-1),/Refresh this Spotify tab/);
  assert.equal(app.disconnected,true);
});

test('missing extension ID prevents API access after a reload',async()=>{
  const app=await setup();app.open();app.change({roughness:25});
  app.sandbox.chrome.runtime.id=undefined;
  await app.runSave();
  assert.equal(app.writes.length,0);assert.equal(app.button.textContent,'Refresh Spotify');
});

test('ordinary storage errors stay recoverable and do not invalidate the tab',async()=>{
  let fail=true;
  const app=await setup({set:()=>{if(fail)throw new Error('Storage temporarily unavailable');return Promise.resolve();}});
  app.open();app.change({shine:85});await app.runSave();
  assert.match(app.statuses.at(-1),/Could not save settings/);assert.equal(app.disconnected,false);
  fail=false;app.change({shine:90});await app.runSave();
  assert.equal(app.writes.at(-1).settings.shine,90);assert.equal(app.writes.length,2);
});

test('successful saves debounce to the most recent settings',async()=>{
  const app=await setup();app.open();
  app.change({depth:20});app.change({depth:70});await app.runSave();
  assert.equal(app.writes.length,1);assert.equal(app.writes[0].settings.depth,70);
  assert.equal(app.disconnected,false);
});

test('leaving the page cancels an outstanding save',async()=>{
  const app=await setup();app.open();app.change({depth:70});
  const pending=[...app.timeouts.values()].find(task=>task.delay===180);
  app.pagehide();assert.equal(app.timeouts.size,0);assert.equal(app.intervals.size,0);
  await pending.fn();assert.equal(app.writes.length,0);
});

test('initial settings lookup catches synchronous invalidation and promise rejection',async()=>{
  for(const get of [()=>{throw new Error('Extension context invalidated.');},()=>Promise.reject(new Error('Extension context invalidated.'))]){
    const app=await setup({get});
    assert.equal(app.button.textContent,'Refresh Spotify');assert.equal(app.disconnected,true);
    assert.equal(app.intervals.size,0);assert.equal(app.timeouts.size,0);
  }
});
