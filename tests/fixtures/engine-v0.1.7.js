/* Shared dependency-free WebGL renderer; also exercised by preview.html. */
(() => {
  'use strict';
  const defaults = {enabled: true, inline: true, preset: 'foil', depth: 48, roughness: 38, shine: 65, sparkle: 32, motion: true, parallax: true};
  const presets = {
    foil: {depth: 48, roughness: 38, shine: 65, sparkle: 32},
    gloss: {depth: 22, roughness: 20, shine: 58, sparkle: 4},
    embossed: {depth: 76, roughness: 72, shine: 35, sparkle: 0}
  };
  function normalize(settings = {}) {
    const result = {...defaults};
    for (const key of ['enabled','inline','motion','parallax']) if (typeof settings[key] === 'boolean') result[key] = settings[key];
    for (const key of ['depth','roughness','shine','sparkle']) if (Number.isFinite(settings[key])) result[key] = Math.max(0, Math.min(100, settings[key]));
    if (Object.hasOwn(presets, settings.preset)) result.preset = settings.preset;
    return result;
  }
  function deriveMaps(data, width, height) {
    const count = width * height, lum = new Float32Array(count), heights = new Float32Array(count);
    const normal = new Uint8Array(count * 4), material = new Uint8Array(count * 4);
    const sample = (array, x, y) => array[Math.max(0, Math.min(height-1, y)) * width + Math.max(0, Math.min(width-1, x))];
    for (let i=0; i<count; i++) lum[i] = (data[i*4]*.2126 + data[i*4+1]*.7152 + data[i*4+2]*.0722)/255;
    // Smooth broad relief before displacement so tiny image details don't become spikes.
    const horizontal=new Float32Array(count),smooth=new Float32Array(count),kernel=[1,4,6,4,1];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let value=0;for(let k=-2;k<=2;k++)value+=sample(lum,x+k,y)*kernel[k+2];
      horizontal[y*width+x]=value/16;
    }
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let value=0;for(let k=-2;k<=2;k++)value+=sample(horizontal,x,y+k)*kernel[k+2];
      smooth[y*width+x]=value/16;
    }
    // An image-derived height estimate, not semantic foreground/background depth.
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      const i=y*width+x;
      heights[i]=Math.max(0,Math.min(1,.12+smooth[i]*.76+(lum[i]-smooth[i])*.12));
    }
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      const i=y*width+x, at=(dx,dy)=>sample(heights,x+dx,y+dy);
      const gx=at(1,-1)+2*at(1,0)+at(1,1)-at(-1,-1)-2*at(-1,0)-at(-1,1);
      const gy=at(-1,1)+2*at(0,1)+at(1,1)-at(-1,-1)-2*at(0,-1)-at(1,-1);
      const nx=-gx*2, ny=gy*2, length=Math.hypot(nx,ny,1), edge=Math.min(1,Math.hypot(gx,gy));
      normal.set([(nx/length*.5+.5)*255,(ny/length*.5+.5)*255,(1/length*.5+.5)*255,255],i*4);
      const max=Math.max(data[i*4],data[i*4+1],data[i*4+2])/255, min=Math.min(data[i*4],data[i*4+1],data[i*4+2])/255;
      material.set([heights[i]*255, (0.26+edge*.4+(1-lum[i])*.2)*255, (.35+(max-min)*.4+lum[i]*.25)*255,255],i*4);
    }
    return {normal,material,heights};
  }
  // Keep geometry flat: inferred brightness must never fold or occlude the cover.
  const vertex=`attribute vec2 position; varying vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const fragment=`precision highp float;
    varying vec2 uv; uniform sampler2D art; uniform sampler2D normals; uniform sampler2D material;
    uniform vec2 pointer; uniform float time,depth,roughness,shine,sparkle,foil,original,showDisplacement,displacementLimit;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      // Inspect the height field without lighting or texture offset.
      if(showDisplacement>.5){gl_FragColor=vec4(vec3(texture2D(material,uv).r),1.);return;}
      float height=texture2D(material,uv).r;
      float border=smoothstep(0.,.06,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
      // At full strength the offset stays below one CSS pixel per axis.
      // One bounded lookup avoids feedback, mesh folds and self-occlusion.
      vec2 p=uv+clamp(pointer,vec2(-1.),vec2(1.))*(height-.5)*depth*displacementLimit*border;
      vec3 base=texture2D(art,p).rgb; vec3 n=normalize(mix(vec3(0.,0.,1.),texture2D(normals,p).rgb*2.-1.,depth*.95));
      vec3 m=texture2D(material,p).rgb;
      // A nearby light moves a visible highlight across the cover, rather than
      // illuminating every pixel from almost the same direction.
      vec3 point=vec3(p*2.-1.,0.);
      vec3 lamp=vec3(sin(time*.48)*1.2+pointer.x*1.6,cos(time*.37)*.85+pointer.y*1.6,1.5);
      vec3 light=normalize(lamp-point);
      vec3 view=normalize(vec3(0.,0.,2.8)-point); vec3 halfV=normalize(light+view);
      float r=clamp(roughness*.75+m.g*.25,.08,.96);
      float spec=pow(max(dot(n,halfV),0.),mix(140.,6.,r))*mix(1.,.65,r);
      float lambert=max(dot(n,light),0.);
      vec3 rainbow=.5+.5*cos(6.28318*(vec3(0.,.33,.67)+p.x*.68+p.y*.42+dot(n,light)*.35+time*.035));
      // Broader matte highlights remain visible at high roughness. A bounded
      // exposure curve gives the intensity slider useful range without clipping.
      float reflection=1.-exp(-spec*shine*3.2*(.6+m.b*.4));
      vec3 tint=mix(vec3(1.),.35+rainbow*.65,foil*.85);
      vec3 litBase=clamp(base*(1.+(lambert-light.z)*depth*shine*.75),0.,1.);
      vec3 color=1.-(1.-litBase)*(1.-reflection*tint*.9);
      float sweep=pow(max(0.,1.-abs((p.x+p.y*.46)-(.65+sin(time*.48)*.60+pointer.x*.3))),18.);
      color=1.-(1.-color)*(1.-rainbow*sweep*shine*foil*.28);
      vec2 grid=floor(p*200.);float seed=hash(grid);vec2 cell=fract(p*200.)-.5;
      float star=pow(max(0.,1.-abs(cell.x)*2.),22.)*pow(max(0.,1.-abs(cell.y)*2.),3.)+pow(max(0.,1.-abs(cell.y)*2.),22.)*pow(max(0.,1.-abs(cell.x)*2.),3.);
      float twinkle=pow(max(0.,sin(time*.85+seed*80.+pointer.x*3.)),18.);
      color+=star*step(.983,seed)*twinkle*sparkle*2.5;
      gl_FragColor=vec4(mix(color,texture2D(art,uv).rgb,original),1.);
    }`;
  class Renderer {
    constructor(canvas, settings, onError=()=>{}) {
      this.canvas=canvas; this.settings=normalize(settings); this.pointer=[0,0];this.target=[0,0];this.time=0;this.last=0;this.ready=false;this.active=true;this.dead=false;this.textures=[];this.onError=onError;
      const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false});
      if(!gl) throw new Error('WebGL is unavailable. Your original artwork is still available.');
      this.maxTextureSize=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));
      this.maxRenderSize=Math.min(2048,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
      gl.disable(gl.DEPTH_TEST);
      const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
      const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),program=this.program=gl.createProgram();
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Could not start the artwork shader.');
      gl.useProgram(program);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      this.uniforms={};for(const key of ['art','normals','material','pointer','time','depth','roughness','shine','sparkle','foil','original','showDisplacement','displacementLimit'])this.uniforms[key]=gl.getUniformLocation(program,key);
      this.lost=e=>{e.preventDefault();this.ready=false;onError('Graphics context lost. Close and reopen the artwork view.');};canvas.addEventListener('webglcontextlost',this.lost);
      this.tick=this.tick.bind(this);this.frame=requestAnimationFrame(this.tick);
    }
    setImage(image) {
      if(this.dead) return;
      const scratch=document.createElement('canvas'),size=Math.min(512,Math.max(image.naturalWidth||image.width,1));scratch.width=scratch.height=size;
      const ctx=scratch.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,size,size);
      const pixels=ctx.getImageData(0,0,size,size),maps=deriveMaps(pixels.data,size,size),gl=this.gl;
      // Only inference maps use the small scratch canvas. Preserve the cover's native detail.
      let artwork=image;
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
      if(Math.max(width,height)>this.maxTextureSize){
        artwork=document.createElement('canvas');const scale=this.maxTextureSize/Math.max(width,height);
        artwork.width=Math.max(1,Math.round(width*scale));artwork.height=Math.max(1,Math.round(height*scale));
        const context=artwork.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(image,0,0,artwork.width,artwork.height);
      }
      this.textures.forEach(t=>gl.deleteTexture(t));this.textures=[];
      [artwork,maps.normal,maps.material].forEach((source,index)=>{
        const texture=gl.createTexture();this.textures.push(texture);gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        // Typed arrays aren't affected by UNPACK_FLIP_Y; explicitly flip generated map rows.
        if(index===0){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
        else {const flipped=new Uint8Array(source.length);for(let y=0;y<size;y++)flipped.set(source.subarray(y*size*4,(y+1)*size*4),(size-y-1)*size*4);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,flipped);}
        gl.uniform1i(this.uniforms[['art','normals','material'][index]],index);
      });
      // A small, saturated average makes the surrounding room follow the album.
      let red=0,green=0,blue=0,weight=0;
      for(let i=0;i<pixels.data.length;i+=64){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],w=(Math.max(r,g,b)-Math.min(r,g,b))/255+.1;red+=r*w;green+=g*w;blue+=b*w;weight+=w;}
      this.color=`${Math.round(red/weight)}, ${Math.round(green/weight)}, ${Math.round(blue/weight)}`;
      this.ready=true;return this.color;
    }
    tick(now) {
      if(this.dead)return;this.frame=requestAnimationFrame(this.tick);
      if(!this.active||document.hidden||!this.ready){this.last=now;return;}
      const elapsed=now-this.last;if(elapsed<1000/30)return;this.last=now;
      if(this.settings.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches)this.time+=Math.min(elapsed,100)/1000;
      const gl=this.gl,s=this.settings,u=this.uniforms,side=Math.max(1,Math.min(this.maxRenderSize,Math.round(this.canvas.clientWidth*Math.min(devicePixelRatio||1,2))));
      if(this.canvas.width!==side||this.canvas.height!==side){this.canvas.width=this.canvas.height=side;gl.viewport(0,0,side,side);}
      for(let i=0;i<2;i++)this.pointer[i]+=(this.target[i]-this.pointer[i])*.13;
      gl.useProgram(this.program);gl.uniform2f(u.pointer,s.parallax?this.pointer[0]:0,s.parallax?this.pointer[1]:0);
      gl.uniform1f(u.time,this.time);for(const key of ['depth','roughness','shine','sparkle'])gl.uniform1f(u[key],s[key]/100);
      gl.uniform1f(u.foil,s.preset==='foil'?1:0);gl.uniform1f(u.original,this.original||!s.enabled?1:0);gl.uniform1f(u.showDisplacement,this.showDisplacement?1:0);
      gl.uniform1f(u.displacementLimit,2/Math.max(1,this.canvas.clientWidth));
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
    destroy(){this.dead=true;cancelAnimationFrame(this.frame);this.canvas.removeEventListener('webglcontextlost',this.lost);this.textures.forEach(t=>this.gl.deleteTexture(t));this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
  }
  globalThis.Sparunkify={defaults,presets,normalize,deriveMaps,Renderer};
})();
