(() => {
  const S=globalThis.Sparunkify;let settings={...S.defaults};try{settings=S.normalize(JSON.parse(localStorage.getItem('sparunkify-demo')||'{}'));}catch{}
  const surface=S.createSurface({settings,demo:true,onSettings:value=>{try{localStorage.setItem('sparunkify-demo',JSON.stringify(value));}catch{}}});
  // Original code-generated demo cover. The extension uses the actual playing album.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,1024,1024);bg.addColorStop(0,'#42133d');bg.addColorStop(.55,'#e560b3');bg.addColorStop(1,'#160e39');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,1024);
  let seed=27;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  ctx.save();ctx.translate(512,470);ctx.rotate(-.36);
  for(let i=0;i<160;i++){const t=i/159;ctx.beginPath();ctx.ellipse(0,(t-.5)*260,340*(.8+Math.sin(t*Math.PI)*.2),90+Math.sin(t*Math.PI)*125,0,0,Math.PI*2);const g=ctx.createLinearGradient(-340,-200,340,200);g.addColorStop(0,`hsl(${175+t*80},80%,${65-t*20}%)`);g.addColorStop(.3,`hsl(${265+t*50},80%,${30+t*28}%)`);g.addColorStop(.52,`hsl(${330-t*120},80%,${85-t*20}%)`);g.addColorStop(.7,`hsl(${240+t*60},65%,${25+t*25}%)`);g.addColorStop(1,`hsl(${170+t*110},90%,70%)`);ctx.strokeStyle=g;ctx.lineWidth=3;ctx.stroke();}ctx.restore();
  for(let i=0;i<7000;i++){ctx.fillStyle=`rgba(255,230,255,${random()*.1})`;ctx.fillRect(random()*1024,random()*1024,1,1);}
  for(let i=0;i<20;i++){const x=random()*1024,y=random()*750;ctx.fillStyle='#ffe3ff';ctx.beginPath();ctx.arc(x,y,random()*1.7,0,7);ctx.fill();}
  ctx.fillStyle='#fff2fb';ctx.font='500 20px Arial';ctx.fillText('S P A R U N K I F Y   /   V O L .  0 1',58,67);ctx.fillText('A   M A T E R I A L   S T U D Y',58,953);ctx.font='bold 128px Arial';ctx.fillText('AFTER',55,817);ctx.fillText('GLOW',55,921);ctx.font='18px Arial';ctx.fillText('01 — ∞',870,953);
  const image=new Image();image.onload=()=>{surface.setTrack({title:'Afterglow',artist:'Sparunkify · Original demo artwork'});surface.setImage(image);};image.src=canvas.toDataURL();
})();
