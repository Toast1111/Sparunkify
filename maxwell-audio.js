/* Frequency analysis shared with the tests. No Spotify APIs or synthetic levels. */
(() => {
  'use strict';
  function analyse(frequency, waveform, sampleRate, fftSize, gain=1) {
    const binHz=sampleRate/fftSize;
    const decibels=frequency.BYTES_PER_ELEMENT===4;
    const band=(low,high)=>{
      const from=Math.max(1,Math.floor(low/binHz)),to=Math.min(frequency.length-1,Math.ceil(high/binHz));
      let sum=0;for(let i=from;i<=to;i++){
        const amplitude=decibels?10**(frequency[i]/20):frequency[i]/255;
        sum+=amplitude*amplitude;
      }
      // Float FFT values are dB. Convert to linear power before detecting hits;
      // averaging logarithmic byte values made different bass hits look alike.
      return Math.sqrt(sum/(decibels?1:Math.max(1,to-from+1)))*(decibels?3:1)*gain;
    };
    let rms=0;for(const sample of waveform)rms+=sample*sample;
    return {bass:band(35,180),level:Math.sqrt(rms/waveform.length)*2.8*gain};
  }
  const amplitude=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  function deformation(energy){
    const compress=1-Math.exp(-Math.max(0,energy)*.65),stretch=1-Math.exp(-Math.max(0,-energy)*.9);
    // Limit the body shape, not the audio or spin strength. Small and
    // medium hits occupy the middle of this curve; height never drops below 55%.
    const height=1-.45*compress+.2*stretch;
    return {width:1/Math.sqrt(height),height,depth:1};
  }
  class ChannelReference {
    constructor(floor){this.floor=floor;this.level=floor;this.ready=false;}
    normalize(value,dt){
      value=amplitude(value);
      if(!this.ready&&value>=this.floor*.01){this.level=Math.max(this.floor,value);this.ready=true;}
      // Normalize against the preceding history, then update it. Quiet passages
      // lower the reference slowly; silence holds it, and a floor limits gain.
      const normalized=value/this.level;
      if(value>=this.floor*.01){
        const tau=value>this.level?1.5:20;
        this.level=Math.max(this.floor,this.level+(value-this.level)*(1-Math.exp(-dt/tau)));
      }
      return normalized;
    }
  }
  class Dynamics {
    constructor(){
      this.bassReference=new ChannelReference(.08);this.levelReference=new ChannelReference(.12);
      this.previous=0;this.reference=0;this.variation=0;this.ready=false;this.quiet=0;
      this.beat=0;this.hit=0;this.fast=0;this.slow=0;this.armed=true;
    }
    push(bass,level,dt){
      bass=amplitude(bass);level=amplitude(level);dt=Math.max(.001,Math.min(.25,dt));
      const bassDrive=this.bassReference.normalize(bass,dt),levelDrive=this.levelReference.normalize(level,dt);
      const energy=bassDrive*.8+levelDrive*.2,delta=energy-this.previous;
      this.quiet=Math.max(bass,level)<.0005?this.quiet+dt:0;
      if(this.quiet>1)this.ready=false;
      if(!this.ready&&this.quiet===0){this.reference=energy;this.variation=energy*.08;this.ready=true;}
      this.fast+=(energy-this.fast)*(1-Math.exp(-dt/.015));
      this.slow+=(energy-this.slow)*(1-Math.exp(-dt/.15));
      const scale=Math.max(.015,this.reference*.08,this.variation*4),onset=this.fast-this.slow,threshold=scale*.12;
      // Rearm when the onset falls away, with no timed cooldown between hits.
      // A held attack still cannot repeatedly trigger its own spin boost.
      if(onset<=threshold*.25)this.armed=true;
      if(this.armed&&this.quiet===0&&onset>threshold){
        // Keep weak passages weak, without a fixed minimum or an upper speed cap.
        this.beat++;this.hit=Math.log1p(onset/scale)*energy/(energy+.5);
        this.armed=false;
      }
      this.reference+=(energy-this.reference)*(1-Math.exp(-dt/6));
      this.variation+=(Math.abs(delta)-this.variation)*(1-Math.exp(-dt/4));
      this.previous=energy;
      return {bass,level,bassDrive,levelDrive,beat:this.beat,hit:this.hit,drive:energy};
    }
  }
  class Pose {
    constructor(){this.yaw=-1.05;this.age=10;this.strength=0;this.spinKick=0;this.groove=0;}
    hit(strength){
      this.age=0;this.strength=amplitude(strength);this.spinKick+=this.strength*32;
    }
    advance(dt,drive,reduced=false){
      dt=Math.max(0,Math.min(.05,dt));this.age+=dt;
      const target=amplitude(drive),tau=target>this.groove?.08:1.5;
      this.groove+=(target-this.groove)*(1-Math.exp(-dt/tau));
      // Sustained momentum follows the 80/20 energy blend between beats. Hits
      // bypass this envelope, keeping their immediate attack and short decay.
      if(!reduced)this.yaw=(this.yaw+dt*(.35+this.groove*2+this.spinKick))%(Math.PI*2);
      this.spinKick*=Math.exp(-dt*7);
      const decay=Math.exp(-this.age*7)*this.strength,attack=1-Math.exp(-this.age*45);
      // Ease into the squish over several frames, then rebound and settle.
      return {yaw:this.yaw,energy:reduced?0:Math.cos(this.age*12)*decay*attack,
        bounce:0,roll:0};
    }
  }
  globalThis.MaxwellAudio={analyse,Dynamics,Pose,deformation};
})();
