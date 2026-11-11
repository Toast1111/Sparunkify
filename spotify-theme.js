/* Read rendered Spotify backgrounds only around artwork matching the playing album. */
(() => {
  const S=globalThis.Sparunkify,A=globalThis.SparunkifyArtwork;
  const colors=value=>[...value.matchAll(/rgba?\(([^)]+)\)/g)].map(match=>match[1].split(/[,\s/]+/).filter(Boolean).map(Number));
  const visible=color=>color.length>=3&&(color.length<4||color[3]>0);
  function layer(element,pseudo){
    const style=getComputedStyle(element,pseudo);
    if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return null;
    if(pseudo&&(style.content==='none'||style.content==='normal'||style.position!=='absolute'))return null;
    const image=style.backgroundImage;
    // Never copy remote images, artwork itself, or executable/content URLs.
    if(image!=='none'&&(!image.includes('gradient(')||/url\(/i.test(image)))return null;
    const color=style.backgroundColor;
    const values=colors(color+' '+image).filter(visible);
    if(!values.length)return null;
    const chromatic=values.some(rgb=>Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))>12);
    const substantial=values.some(rgb=>Math.max(...rgb.slice(0,3))>35&&(rgb.length<4||rgb[3]>.5));
    return {color,image,opacity:Number(style.opacity),chromatic,substantial};
  }
  S.readSpotifyTheme=function(url){
    const key=A.key(url);if(!key)return null;
    const images=[...document.querySelectorAll('img')].filter(img=>A.key(img.currentSrc||img.src)===key)
      .map(img=>({img,rect:img.getBoundingClientRect()}))
      .filter(({img,rect})=>rect.width>=170&&rect.height>=170&&rect.bottom>0&&rect.top<innerHeight&&getComputedStyle(img).visibility!=='hidden')
      .sort((a,b)=>b.rect.width-a.rect.width);
    for(const {img,rect} of images){
      for(let parent=img.parentElement,depth=0;parent&&parent!==document.body&&depth<10;parent=parent.parentElement,depth++){
        const box=parent.getBoundingClientRect();
        if(box.width<rect.width*1.15&&box.height<rect.height*1.25)continue;
        if(getComputedStyle(parent).display==='none')continue;
        const base=layer(parent);
        {
          const layers=[];
          // Spotify can put its fade on a full-size pseudo element/background child.
          const overlays=[...parent.children].filter(child=>child!==img&&!child.contains(img)&&!child.textContent.trim()&&!child.querySelector('img,canvas,video'));
          for(const child of overlays){
            const style=getComputedStyle(child),bounds=child.getBoundingClientRect();
            if(style.position!=='absolute'||Math.abs(bounds.width-box.width)>2||Math.abs(bounds.height-box.height)>2)continue;
            const overlay=layer(child);if(overlay&&overlay.opacity===1)layers.push(overlay);
          }
          for(const pseudo of ['::after','::before']){
            const style=getComputedStyle(parent,pseudo);
            if(Math.abs(parseFloat(style.width)-box.width)>2||Math.abs(parseFloat(style.height)-box.height)>2)continue;
            const overlay=layer(parent,pseudo);if(overlay&&overlay.opacity===1)layers.push(overlay);
          }
          // Some layouts put the album color entirely on an empty background
          // child, with a transparent/neutral container around the cover.
          if(![...layers,base].some(item=>item&&item.opacity===1&&(item.chromatic||item.substantial)))continue;
          if(base&&base.opacity!==1)continue;
          const gradient=layers.flatMap(item=>[...(item.image==='none'?[]:[item.image]),`linear-gradient(${item.color},${item.color})`]);
          if(base&&base.image!=='none')gradient.push(base.image);
          return {color:base?.color||'rgb(18, 18, 18)',image:gradient.join(', ')||'none',source:'spotify'};
        }
      }
    }
    return null;
  };
})();
