/* Audio stays in this extension document while Spotify remains the visible tab. */
(() => {
  'use strict';
  let stream=null,context=null,source=null,analyser=null,timer=null,generation=0;
  function stop(){
    generation++;clearInterval(timer);timer=null;
    stream?.getTracks().forEach(track=>track.stop());stream=null;source?.disconnect();source=null;analyser=null;
    if(context){void context.close().catch(()=>{});context=null;}
  }
  async function start(streamId,tabId){
    stop();const token=generation;
    const captured=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:streamId}},video:false});
    if(token!==generation){captured.getTracks().forEach(track=>track.stop());return;}
    try{
      stream=captured;context=new AudioContext();analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0;
      source=context.createMediaStreamSource(stream);source.connect(analyser);analyser.connect(context.destination);await context.resume();
      const frequency=new Float32Array(analyser.frequencyBinCount),waveform=new Float32Array(analyser.fftSize);
      let pending=false;
      timer=setInterval(()=>{
        if(pending||token!==generation)return;
        analyser.getFloatFrequencyData(frequency);analyser.getFloatTimeDomainData(waveform);
        const {bass,level}=MaxwellAudio.analyse(frequency,waveform,context.sampleRate,analyser.fftSize);
        pending=true;
        chrome.runtime.sendMessage({type:'maxwell-levels',tabId,bass,level}).catch(()=>stop()).finally(()=>{pending=false;});
      },20);
      stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{if(token===generation){stop();void chrome.runtime.sendMessage({type:'maxwell-ended',tabId}).catch(()=>{});}},{once:true}));
    }catch(error){if(token===generation)stop();throw error;}
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message.target!=='maxwell-offscreen')return;
    if(message.type==='start'){start(message.streamId,message.tabId).then(()=>reply({ok:true}),error=>reply({error:error.message}));return true;}
    if(message.type==='stop'){stop();reply({ok:true});}
  });
  window.addEventListener('pagehide',stop,{once:true});
})();
