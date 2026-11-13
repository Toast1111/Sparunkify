const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sandbox={};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'maxwell-audio.js'),'utf8'),sandbox);
const analyse=sandbox.MaxwellAudio.analyse;
const {Dynamics,Pose,deformation}=sandbox.MaxwellAudio;

test('float FFT analysis converts decibels to linear energy and preserves hit contrast',()=>{
  const frequency=new Float32Array(1024).fill(-Infinity),wave=new Float32Array(2048);
  assert.equal(analyse(frequency,wave,48000,2048).bass,0);
  frequency[4]=-40;const quiet=analyse(frequency,wave,48000,2048).bass;
  frequency[4]=-20;const loud=analyse(frequency,wave,48000,2048).bass;
  assert.ok(Math.abs(loud/quiet-10)<.001,'20 dB must produce 10 times the amplitude');
});
test('held bass triggers once and does not hold the cat squished',()=>{
  const dynamics=new Dynamics(),pose=new Pose();let beats=0,frame;
  for(let i=0;i<200;i++){
    const sample=dynamics.push(.7,.6,.02);
    if(sample.beat!==beats){pose.hit(sample.hit);beats=sample.beat;}
    frame=pose.advance(.02,sample.drive);
  }
  assert.equal(beats,1);assert.ok(Math.abs(frame.energy)<.001);assert.ok(frame.bounce<.001);
});
test('quiet, loud and compressed music all produce repeated distinct hits',()=>{
  for(const [low,high] of [[.015,.05],[.15,.8],[.7,.74]]){
    const dynamics=new Dynamics();let before=0;
    for(let i=0;i<200;i++)before=dynamics.push(low,low,.02).beat;
    for(let beat=0;beat<6;beat++){
      const hit=dynamics.push(high,high,.02);
      assert.equal(hit.beat,before+beat+1,`Missing hit for range ${low}–${high}`);
      assert.ok(hit.hit>0);
      for(let i=0;i<24;i++)dynamics.push(low,low,.02);
    }
  }
});
test('squish eases through intermediate shapes, rebounds and settles',()=>{
  const pose=new Pose(),idle=pose.advance(.01,0);pose.hit(1);
  const slam=pose.advance(.01,0);
  const next=pose.advance(.01,0);
  assert.ok(slam.energy>0&&slam.energy<next.energy&&next.energy<.7,'Attack must pass through intermediate squishes');
  assert.ok(slam.yaw-idle.yaw>.3,'Hit spin must be much faster than idle');
  let rebound=false,frame;
  for(let i=0;i<100;i++){frame=pose.advance(.01,0);if(frame.energy<-.1)rebound=true;}
  assert.ok(rebound);assert.ok(Math.abs(frame.energy)<.001);assert.ok(frame.bounce<.001);
  pose.hit(1);const yaw=pose.yaw,reduced=pose.advance(.02,1,true);
  assert.equal(reduced.yaw,yaw);assert.equal(reduced.energy,0);assert.equal(reduced.bounce,0);assert.equal(reduced.roll,0);
});
test('body compression has a gentle middle range and a separate maximum',()=>{
  const soft=deformation(.25),medium=deformation(1),hard=deformation(4),maximum=deformation(100);
  assert.ok(soft.height>.9);assert.ok(medium.height>.75&&medium.height<.85);
  assert.ok(hard.height>.55&&hard.height<medium.height);
  assert.ok(maximum.height>=.55&&maximum.width<1.35);
  for(const energy of [-100,-4,-1,0,.25,1,4,100]){
    const shape=deformation(energy);assert.ok(shape.height>=.55&&shape.height<=1.2);assert.equal(shape.depth,1);
  }
});

test('silence produces no bass or loudness',()=>{
  const result=analyse(new Uint8Array(1024),new Float32Array(2048),48000,2048);
  assert.equal(result.bass,0);assert.equal(result.level,0);
});
test('bass is measured in Hz, remains separate from treble, and gain preserves values above one',()=>{
  for(const rate of [44100,48000,96000]){
    const frequency=new Uint8Array(1024),wave=new Float32Array(2048).fill(.1);
    frequency[Math.round(90/(rate/2048))]=255;
    const low=analyse(frequency,wave,rate,2048),loud=analyse(frequency,wave,rate,2048,3);
    assert.ok(low.bass>.2);assert.ok(loud.bass>=low.bass);assert.ok(Math.abs(low.level-.28)<.0001);
    frequency.fill(0);frequency[Math.round(6000/(rate/2048))]=255;
    const high=analyse(frequency,wave,rate,2048);
    assert.equal(high.bass,0);assert.ok(high.level>0);
    assert.ok(Math.abs(loud.bass-low.bass*3)<.0001);
  }
  assert.ok(analyse(new Uint8Array(1024).fill(255),new Float32Array(2048).fill(1),48000,2048,3).level>8);
});
test('larger accents keep producing larger responses across the old 100% ceiling',()=>{
  const responses=[.21,.25,.4,.8,1.6,3.2].map(peak=>{
    const dynamics=new Dynamics();for(let i=0;i<200;i++)dynamics.push(.2,.2,.02);
    return dynamics.push(peak,peak,.02);
  });
  for(let i=1;i<responses.length;i++){
    assert.ok(responses[i].hit>responses[i-1].hit);assert.ok(responses[i].drive>responses[i-1].drive);
  }
  assert.ok(responses[0].hit<.65,'Small accents must not be promoted to near-full hits');
  assert.ok(responses.at(-1).hit>1&&responses.at(-1).drive>1);
});
test('relative dynamics are independent of playback gain without discarding stronger hits',()=>{
  function hit(gain){const dynamics=new Dynamics();for(let i=0;i<200;i++)dynamics.push(.1*gain,.15*gain,.02);return dynamics.push(.4*gain,.6*gain,.02);}
  assert.ok(Math.abs(hit(1).hit-hit(20).hit)<.00001);
  assert.ok(Math.abs(hit(1).drive-hit(20).drive)<.00001);
});
test('separate references make a relative bass change contribute four times a relative RMS change',()=>{
  function calibrated(){const dynamics=new Dynamics();for(let i=0;i<300;i++)dynamics.push(.25,1.5,.02);return dynamics;}
  const bass=calibrated().push(.5,1.5,.02),rms=calibrated().push(.25,3,.02);
  assert.ok(Math.abs(bass.drive-1.8)<.00001);assert.ok(Math.abs(rms.drive-1.2)<.00001);
  assert.ok(Math.abs((bass.drive-1)/(rms.drive-1)-4)<.00001);
  const scaled=new Dynamics();for(let i=0;i<300;i++)scaled.push(2.5,1.5,.02);
  assert.ok(Math.abs(scaled.push(5,1.5,.02).drive-bass.drive)<.00001,'Changing bass-channel units must not change the blend');
});
test('quiet passages and a whisper after silence do not normalize into full-strength music',()=>{
  const dynamics=new Dynamics();for(let i=0;i<300;i++)dynamics.push(.8,.6,.02);
  const quiet=[];for(let i=0;i<500;i++)quiet.push(dynamics.push(.008,.006,.02));
  assert.ok(quiet.every(sample=>sample.drive<.025));
  assert.equal(quiet.at(-1).beat,quiet[0].beat,'Reference adaptation must not create fake hits');
  for(let i=0;i<150;i++)dynamics.push(0,0,.02);
  const whisper=dynamics.push(.008,.006,.02);assert.ok(whisper.drive<.025);assert.ok(whisper.hit<.05);
  const startup=new Dynamics();let sample;for(let i=0;i<3000;i++)sample=startup.push(.001,.001,.02);
  assert.ok(sample.drive<.02&&sample.hit<.05,'Reference floors must preserve quiet input even without louder history');
});
test('30 seconds of quiet followed by a 100x amplitude step has finite headroom and one onset',()=>{
  for(const warm of [false,true]){
    const dynamics=new Dynamics(),pose=new Pose();let lastBeat=0;
    function step(bass,level){
      const sample=dynamics.push(bass,level,.02);
      if(sample.beat!==lastBeat){pose.hit(sample.hit);lastBeat=sample.beat;}
      const frame=pose.advance(.02,sample.drive);
      assert.ok(Number.isFinite(sample.drive)&&Number.isFinite(sample.hit)&&Number.isFinite(frame.yaw));
      return sample;
    }
    if(warm)for(let i=0;i<500;i++)step(.8,.6);
    for(let i=0;i<1500;i++)step(.008,.006);
    const before=dynamics.beat,first=step(.8,.6);let previous=first.drive;
    assert.ok(first.drive>4&&first.drive<=9,'The transition may exceed one; it must retain finite headroom');
    for(let i=1;i<=300;i++){
      const sample=step(.8,.6);
      assert.ok(sample.drive<=previous,'References must catch up monotonically to a held loud level');
      if(i===75)assert.ok(sample.drive>1.3&&sample.drive<1.6,'After 1.5 seconds the drive should be recovering toward baseline');
      if(i===225)assert.ok(sample.drive>1&&sample.drive<1.06,'After 4.5 seconds the drive should be within 6% of baseline');
      if(i===300)assert.ok(sample.drive>1&&sample.drive<1.02);
      previous=sample.drive;
    }
    assert.equal(dynamics.beat-before,1,'A held loud entrance must not keep adding hit impulses');
  }
});
test('one broad or ringing kick produces one hit across analysis update rates',()=>{
  for(const dt of [.01,.02,1/30]){
    for(const shape of ['broad','ringing']){
      const dynamics=new Dynamics();for(let t=0;t<2;t+=dt)dynamics.push(.02,.02,dt);
      const before=dynamics.beat;
      for(let t=0;t<1.5;t+=dt){
        const envelope=shape==='broad'?(t<.32?t/.32:t<.4?1:Math.exp(-(t-.4)/.15)):Math.exp(-t/.12)*(1+.12*Math.sin(2*Math.PI*18*t));
        dynamics.push(.02+.8*envelope,.02+.6*envelope,dt);
      }
      assert.equal(dynamics.beat-before,1,`${shape} kick at ${dt}s updates must not double-trigger`);
    }
  }
});
test('separate fast kicks rearm without being mistaken for one held onset',()=>{
  for(const dt of [.01,.02,1/30]){
    const dynamics=new Dynamics();for(let t=0;t<2;t+=dt)dynamics.push(.02,.02,dt);
    const before=dynamics.beat;
    for(let i=0;i<Math.round(1/dt);i++){
      const phase=(i*dt+.000001)%.2,envelope=Math.exp(-phase/.045);
      dynamics.push(.02+.8*envelope,.02+.6*envelope,dt);
    }
    assert.equal(dynamics.beat-before,5,`Five kicks at ${dt}s updates should produce five hits`);
  }
});
test('distinct hits 100 ms apart each add spin without a timed cooldown',()=>{
  for(const dt of [.01,.02]){
    const dynamics=new Dynamics(),pose=new Pose();
    for(let i=0;i<Math.round(2/dt);i++)dynamics.push(.02,.02,dt);
    let lastBeat=dynamics.beat,boosts=0;
    const framesPerHit=Math.round(.1/dt);
    for(let i=0;i<5*framesPerHit;i++){
      const peak=i%framesPerHit===0;
      const sample=dynamics.push(peak?.82:.02,peak?.62:.02,dt);
      if(sample.beat!==lastBeat){
        const previousSpin=pose.spinKick;
        pose.hit(sample.hit);lastBeat=sample.beat;boosts++;
        assert.ok(pose.spinKick>previousSpin,'Each detected hit must immediately add a spin boost');
      }
      const frame=pose.advance(dt,sample.drive);
      assert.ok(deformation(frame.energy).height>=.55,'Rapid hits must retain the squish floor');
    }
    assert.equal(boosts,5,`All five hits 100 ms apart must trigger at ${dt}s updates`);
  }
});

test('groove rises promptly and carries rotation through gaps with a 1.5 second release',()=>{
  for(const dt of [.01,.02,.05]){
    const pose=new Pose();
    for(let i=0;i<Math.round(.4/dt);i++)pose.advance(dt,1);
    assert.ok(pose.groove>.99,'Sustained music should establish momentum within 400 ms');
    for(let i=0;i<Math.round(.5/dt);i++)pose.advance(dt,0);
    assert.ok(pose.groove>.71&&pose.groove<.72,'A half-second beat gap should retain about 72% of the groove');
    for(let i=0;i<Math.round(1/dt);i++)pose.advance(dt,0);
    assert.ok(pose.groove>.36&&pose.groove<.37,'1.5 seconds of silence should leave about 37%');
    for(let i=0;i<Math.round(12/dt);i++)pose.advance(dt,0);
    assert.ok(pose.groove<.001,'Momentum must settle back to idle in silence');
  }
  const pose=new Pose();for(let i=0;i<4;i++)pose.advance(.02,1);
  assert.ok(pose.groove>.63&&pose.groove<.64,'80 ms attack should reach about 63%');
});

test('a steady beat sustains groove without accumulating hit impulses into that envelope',()=>{
  for(const bpm of [120,180,300]){
    const withHits=new Pose(),withoutHits=new Pose(),interval=60/bpm,dt=.01;
    let nextHit=0,minimumGroove=Infinity;
    for(let i=0;i<2000;i++){
      const time=i*dt;
      if(time+1e-8>=nextHit){withHits.hit(1);nextHit+=interval;}
      const drive=(time+1e-8)%interval<.06?1:0;
      const frame=withHits.advance(dt,drive);withoutHits.advance(dt,drive);
      assert.equal(withHits.groove,withoutHits.groove,'Hit impulses must bypass sustained momentum');
      assert.equal(frame.bounce,0);assert.equal(frame.roll,0);
      assert.ok(withHits.spinKick<=32/(1-Math.exp(-7*interval))+1e-6,'Fast passages must retain the short hit release');
      if(time>5)minimumGroove=Math.min(minimumGroove,withHits.groove);
    }
    assert.ok(minimumGroove>.5,`Groove should keep turning between beats at ${bpm} BPM`);
  }
});

test('silence keeps a gentle idle spin and sustained groove has no speed cap',()=>{
  const idle=new Pose(),start=idle.yaw;
  for(let i=0;i<100;i++)idle.advance(.01,0);
  assert.ok(Math.abs(idle.yaw-start-.35)<1e-10);assert.equal(idle.groove,0);
  const pose=new Pose();for(let i=0;i<100;i++)pose.advance(.02,100);
  assert.ok(pose.groove>99,'Large continuous drive must retain its headroom');
  const yaw=pose.yaw,frame=pose.advance(.02,100,true);
  assert.equal(frame.yaw,yaw);assert.equal(frame.energy,0);
});
test('hit impulse remains immediate with its original release envelope',()=>{
  const pose=new Pose(),yaw=pose.yaw;pose.hit(1);pose.advance(.02,0);
  assert.ok(pose.yaw-yaw>.64,'Drive smoothing must not delay or soften the impulse');
  assert.ok(Math.abs(pose.spinKick-32*Math.exp(-7*.02))<.00001);
});
test('stronger hits keep increasing spin while Maxwell stays planted',()=>{
  const results=[.25,.5,1,2,4,8].map(strength=>{
    const pose=new Pose();pose.hit(strength);const spin=pose.spinKick;
    for(let i=0;i<400;i++){const frame=pose.advance(.01,0);assert.equal(frame.bounce,0);assert.equal(frame.roll,0);}
    return {spin};
  });
  for(let i=1;i<results.length;i++)assert.ok(results[i].spin>results[i-1].spin);
  const zero=new Pose();zero.hit(0);assert.equal(zero.advance(.02,0).bounce,0);assert.equal(zero.spinKick,0);
});

function worker({url='https://open.spotify.com/track/test',captured=[],failure=null}={}){
  let listener,calls=[],offscreen=false,stops=0,forwarded=[];
  const context={URL,importScripts:()=>{},chrome:{
    storage:{local:{get:async()=>({settings:{enabled:true}}),set:async()=>{}}},
    runtime:{getURL:file=>'chrome-extension://test/'+file,onMessage:{addListener:fn=>listener=fn},sendMessage:async message=>({ok:true})},
    offscreen:{hasDocument:async()=>offscreen,createDocument:async()=>{offscreen=true;},closeDocument:async()=>{offscreen=false;stops++;}},
    tabs:{get:async id=>({id,url}),sendMessage:async(id,message)=>{forwarded.push({id,message});return {ok:true};}},
    tabCapture:{getCapturedTabs:async()=>captured,getMediaStreamId:async options=>{calls.push(options);if(failure)throw Error(failure);return 'one-time-token';}}
  }};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'players.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),context);
  return {calls,forwarded,get stops(){return stops;},get offscreen(){return offscreen;},request:(sender={url:'chrome-extension://test/popup.html'},message={type:'maxwell-start',targetTabId:12})=>new Promise(resolve=>listener(message,sender,resolve))};
}
test('popup starts audio in an offscreen document and stop releases it',async()=>{
  const app=worker(),response=await app.request();assert.equal(response.ok,true);
  assert.equal(app.calls[0].targetTabId,12);assert.equal(app.offscreen,true);
  await app.request(undefined,{type:'maxwell-stop'});assert.equal(app.offscreen,false);assert.equal(app.stops,1);
});
test('YouTube Music uses the same capture flow and lookalike player hosts are rejected',async()=>{
  const app=worker({url:'https://music.youtube.com/watch?v=demo'});
  assert.equal((await app.request()).ok,true);assert.equal(app.calls[0].targetTabId,12);
  await app.request(undefined,{type:'maxwell-stop'});assert.equal(app.offscreen,false);
  const other=worker({url:'https://music.youtube.com.evil.example/'});
  assert.match((await other.request()).error,/Choose/);assert.equal(other.calls.length,0);
});
test('page scripts and unsupported player targets cannot request audio capture',async()=>{
  const app=worker();assert.match((await app.request({url:'https://open.spotify.com/',tab:{id:12}})).error,/popup/);assert.equal(app.calls.length,0);
  const other=worker({url:'https://example.com/'});assert.match((await other.request()).error,/Spotify/);assert.equal(other.calls.length,0);
});
test('duplicate captures and browser permission failures return actionable errors',async()=>{
  const duplicate=worker({captured:[{tabId:12,status:'active'}]});assert.match((await duplicate.request()).error,/already in use/);assert.equal(duplicate.calls.length,0);
  const denied=worker({failure:'Permission denied'});assert.match((await denied.request()).error,/Permission denied/);assert.equal(denied.offscreen,false);
});
test('offscreen samples retain headroom and reject invalid amplitudes',async()=>{
  const app=worker();await app.request({url:'chrome-extension://test/maxwell-offscreen.html'},{type:'maxwell-levels',tabId:12,bass:8,level:-2});
  assert.equal(app.forwarded[0].id,12);assert.equal(app.forwarded[0].message.bass,8);assert.equal(app.forwarded[0].message.level,0);
  await app.request({url:'chrome-extension://test/maxwell-offscreen.html'},{type:'maxwell-levels',tabId:12,bass:Infinity,level:NaN});
  assert.equal(app.forwarded[1].message.bass,0);assert.equal(app.forwarded[1].message.level,0);
});
test('converted mesh includes body and whiskers with valid interleaved vertices',()=>{
  const model={};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/maxwell/mesh.js'),'utf8'),model);
  assert.equal(model.MaxwellMesh.length,2);
  for(const mesh of model.MaxwellMesh){assert.ok(mesh.length>0);assert.equal(mesh.length%24,0);assert.ok(mesh.every(Number.isFinite));}
});
