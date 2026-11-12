/* A small static-mesh WebGL renderer. The actual supplied FBX, including whiskers. */
(() => {
  'use strict';
  const vertex=`attribute vec3 position;attribute vec3 normal;attribute vec2 uv;
    uniform float yaw;uniform float aspect;uniform vec3 squash;
    varying vec2 texcoord;varying vec3 n;
    void main(){float c=cos(yaw),s=sin(yaw);mat3 turn=mat3(c,0.,-s,0.,1.,0.,s,0.,c);
      vec3 p=(turn*position)*squash;
      p.y-=.65;float py=p.y*.97-p.z*.243;p.z=p.y*.243+p.z*.97-5.;p.y=py;
      gl_Position=vec4(p.x*2.6/aspect,p.y*2.6,-1.002*p.z-.2002,-p.z);
      n=(turn*normal)/squash;texcoord=uv;}`;
  const fragment=`precision mediump float;varying vec2 texcoord;varying vec3 n;uniform sampler2D image;
    void main(){vec4 color=texture2D(image,texcoord);if(color.a<.3)discard;
      float light=.85+.25*max(0.,dot(normalize(n),normalize(vec3(-.4,1.,1.))));
      gl_FragColor=vec4(pow(color.rgb,vec3(.78))*light,color.a);}`;
  class Renderer {
    constructor(canvas) {
      this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
      if(!this.gl)throw Error('Maxwell needs WebGL. Enable hardware acceleration in your browser.');
      const gl=this.gl,shaders=[];
      try{
        this.program=gl.createProgram();
        for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Could not compile Maxwell’s renderer.');gl.attachShader(this.program,shader);
        }
        gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Could not start Maxwell’s renderer.');
      }finally{shaders.forEach(shader=>gl.deleteShader(shader));}
      this.uniforms=Object.fromEntries(['yaw','squash','aspect','image'].map(name=>[name,gl.getUniformLocation(this.program,name)]));
      this.meshes=MaxwellMesh.map((data,i)=>{
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
        const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([90,90,80,i?0:255]));
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        return {buffer,texture,count:data.length/8};
      });
      this.ready=Promise.all(this.meshes.map(async(mesh,i)=>{
        const image=new Image();image.crossOrigin='anonymous';
        const base=globalThis.chrome?.runtime?.getURL?chrome.runtime.getURL('assets/maxwell/'):'assets/maxwell/';
        image.src=base+(i?'dingus_whiskers.tga.png':'dingus_nowhiskers.jpg');await image.decode();if(this.disposed)return;
        gl.bindTexture(gl.TEXTURE_2D,mesh.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      }));
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      this.lost=event=>{event.preventDefault();canvas.dispatchEvent(new CustomEvent('maxwell-error',{detail:'The 3D view lost its graphics context. Reload this page to bring Maxwell back.'}));};
      canvas.addEventListener('webglcontextlost',this.lost);
    }
    draw({yaw,energy}) {
      const gl=this.gl,canvas=this.canvas,dpr=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const shape=MaxwellAudio.deformation(energy);
      gl.uniform3f(this.uniforms.squash,shape.width,shape.height,shape.depth);
      for(const [name,value] of Object.entries({yaw,aspect:w/h}))gl.uniform1f(this.uniforms[name],value);
      gl.uniform1i(this.uniforms.image,0);gl.activeTexture(gl.TEXTURE0);
      for(const [i,mesh] of this.meshes.entries()){
        gl.depthMask(i===0);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bindTexture(gl.TEXTURE_2D,mesh.texture);
        for(const [name,size,offset] of [['position',3,0],['normal',3,12],['uv',2,24]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);}
        gl.drawArrays(gl.TRIANGLES,0,mesh.count);
      }
      gl.depthMask(true);
    }
    destroy(){this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.lost);for(const mesh of this.meshes){this.gl.deleteBuffer(mesh.buffer);this.gl.deleteTexture(mesh.texture);}this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
  }
  globalThis.MaxwellRenderer=Renderer;
})();
