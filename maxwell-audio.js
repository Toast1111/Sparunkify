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
  class Dynamics {
    constructor(){this.previous=0;this.reference=0;this.variation=0;this.ready=false;this.quiet=0;this.cooldown=1;this.beat=0;this.hit=0;}
    push(bass,level,dt){
      bass=amplitude(bass);level=amplitude(level);dt=Math.max(.001,Math.min(.25,dt));
      const energy=bass*.8+level*.2,delta=energy-this.previous;
      this.quiet=energy<.0005?this.quiet+dt:0;
      if(this.quiet>1)this.ready=false;
      const first=!this.ready&&energy>=.0005;
      if(first){this.reference=energy;this.variation=energy*.08;this.ready=true;}
      // Use the preceding several seconds, not the current peak, as the scale.
      // Ratios may exceed one. A loud accent cannot redefine itself as "100%".
      const scale=Math.max(.00001,this.reference*.08,this.variation*4),rise=delta/scale;
      this.cooldown+=dt;
      if(energy>=.0005&&(first||rise>.12)&&this.cooldown>=.14){
        // Smooth compression has no upper ceiling or minimum full-strength hit.
        this.beat++;this.hit=first?1:Math.log1p(rise);this.cooldown=0;
      }
      const drive=energy/Math.max(.00001,this.reference);
      this.reference+=(energy-this.reference)*(1-Math.exp(-dt/6));
      this.variation+=(Math.abs(delta)-this.variation)*(1-Math.exp(-dt/4));
      this.previous=energy;
      return {bass,level,beat:this.beat,hit:this.hit,drive};
    }
  }
  class Pose {
    constructor(){this.yaw=-1.05;this.age=10;this.strength=0;this.spinKick=0;}
    hit(strength){
      this.age=0;this.strength=amplitude(strength);this.spinKick+=this.strength*32;
    }
    advance(dt,drive,reduced=false){
      dt=Math.max(0,Math.min(.05,dt));this.age+=dt;
      if(!reduced)this.yaw=(this.yaw+dt*(.35+amplitude(drive)*2+this.spinKick))%(Math.PI*2);
      this.spinKick*=Math.exp(-dt*7);
      const decay=Math.exp(-this.age*7)*this.strength,attack=1-Math.exp(-this.age*45);
      // Ease into the squish over several frames, then rebound and settle.
      return {yaw:this.yaw,energy:reduced?0:Math.cos(this.age*12)*decay*attack,
        bounce:0,roll:0};
    }
  }
  globalThis.MaxwellAudio={analyse,Dynamics,Pose,deformation};
})();
