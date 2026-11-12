/* Optional Maxwell below the existing artwork, sharing one audio sample stream. */
(() => {
  'use strict';
  const S=globalThis.Sparunkify;
  const dynamics=new MaxwellAudio.Dynamics();
  S.maxwellLevels={bass:0,level:0,beat:0,hit:0,drive:0,at:0};
  S.setMaxwellLevels=function(bass,level){const now=performance.now();S.maxwellLevels={...dynamics.push(bass,level,(now-S.maxwellLevels.at)/1000),at:now};};
  S.MaxwellCat=class {
    constructor(container,onError=()=>{}){
      this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Maxwell cat spinning and squishing to the music');
      this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 8px 7px #0008)';
      container.append(this.canvas);this.pose=new MaxwellAudio.Pose();this.lastBeat=S.maxwellLevels.beat;this.active=true;this.last=performance.now();
      try{this.renderer=new MaxwellRenderer(this.canvas);}catch(error){this.canvas.remove();throw error;}
      this.renderer.ready.catch(()=>{if(!this.dead){onError('Maxwell’s textures could not load. Reload the extension and refresh Spotify.');this.destroy();}});
      this.error=event=>{onError(event.detail);this.destroy();};this.canvas.addEventListener('maxwell-error',this.error);
      this.tick=now=>{
        if(this.dead)return;
        const dt=Math.min(.05,(now-this.last)/1000);this.last=now;
        if(this.active&&!document.hidden){
          const sample=now-S.maxwellLevels.at<300?S.maxwellLevels:{beat:this.lastBeat,drive:0};
          if(sample.beat!==this.lastBeat){this.pose.hit(sample.hit);this.lastBeat=sample.beat;}
          const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
          this.renderer.draw(this.pose.advance(dt,sample.drive,reduced));
        }
        this.frame=requestAnimationFrame(this.tick);
      };
      this.frame=requestAnimationFrame(this.tick);
    }
    destroy(){if(this.dead)return;this.dead=true;cancelAnimationFrame(this.frame);this.canvas.removeEventListener('maxwell-error',this.error);this.renderer.destroy();this.canvas.remove();}
  };
})();
