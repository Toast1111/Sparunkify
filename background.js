/* Fetch only Spotify artwork. No cookies, credentials, arbitrary URLs or page scripts. */
importScripts('artwork.js');
let maxwellQueue=Promise.resolve();
function queueMaxwell(task){const next=maxwellQueue.then(task);maxwellQueue=next.catch(()=>{});return next;}
async function stopMaxwell(){
  if(await chrome.offscreen.hasDocument()){
    try{await chrome.runtime.sendMessage({target:'maxwell-offscreen',type:'stop'});}finally{await chrome.offscreen.closeDocument();}
  }
}
async function disableMaxwell(){
  await stopMaxwell();
  const {settings={}}=await chrome.storage.local.get('settings');
  await chrome.storage.local.set({settings:{...settings,maxwell:false}});
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if(message.type==='maxwell-levels'||message.type==='maxwell-ended'){
    if(sender.url!==chrome.runtime.getURL('maxwell-offscreen.html')||!Number.isInteger(message.tabId))return;
    if(message.type==='maxwell-ended'){
      queueMaxwell(disableMaxwell).then(()=>reply({ok:true}),error=>reply({error:error.message}));
    }else{
      const amplitude=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
      chrome.tabs.sendMessage(message.tabId,{type:'maxwell-levels',bass:amplitude(message.bass),level:amplitude(message.level)})
        .then(()=>reply({ok:true}),()=>{void queueMaxwell(disableMaxwell).catch(()=>{});reply({ok:false});});
    }
    return true;
  }
  if(message.type==='maxwell-start'||message.type==='maxwell-stop'){
    if(sender.url!==chrome.runtime.getURL('popup.html')){reply({error:'Turn Maxwell on from the extension popup on Spotify.'});return;}
    queueMaxwell(async()=>{
      if(message.type==='maxwell-stop'){await disableMaxwell();return {ok:true};}
      if(!Number.isInteger(message.targetTabId))throw Error('Open the extension on a Spotify tab first.');
      const tab=await chrome.tabs.get(message.targetTabId);
      if(!tab.url?.startsWith('https://open.spotify.com/'))throw Error('Choose a Spotify Web Player tab.');
      await stopMaxwell();
      const captured=await chrome.tabCapture.getCapturedTabs();
      if(captured.some(entry=>entry.tabId===tab.id&&['pending','active'].includes(entry.status)))throw Error('Spotify audio is already in use by another capture.');
      await chrome.offscreen.createDocument({url:'maxwell-offscreen.html',reasons:['USER_MEDIA'],justification:'Analyse Spotify tab audio for the optional spinning Maxwell cat and preserve audible playback.'});
      try{
        const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:tab.id});
        const response=await chrome.runtime.sendMessage({target:'maxwell-offscreen',type:'start',streamId,tabId:tab.id});
        if(!response?.ok)throw Error(response?.error||'Could not start audio analysis.');
        const {settings={}}=await chrome.storage.local.get('settings');
        await chrome.storage.local.set({settings:{...settings,maxwell:true,enabled:true}});
        return {ok:true};
      }catch(error){await stopMaxwell();throw error;}
    }).then(reply,error=>reply({error:error.message}));
    return true;
  }
  if (message.type !== 'artwork') return;
  if (!sender.tab?.url?.startsWith('https://open.spotify.com/')) {
    reply({error: 'This request must come from Spotify.'}); return;
  }
  (async () => {
    const url = new URL(message.url);
    if (url.protocol !== 'https:' || !['i.scdn.co', 'mosaic.scdn.co'].includes(url.hostname)) {
      throw new Error('Unsupported artwork host.');
    }
    let failure;
    for (const candidate of SparunkifyArtwork.candidates(url.href)) {
      try {
        const response = await fetch(candidate, {credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000)});
        if (!response.ok) throw new Error(`Artwork request failed (${response.status}).`);
        const type = response.headers.get('content-type') || '';
        if (!/^image\/(jpeg|png|webp)(;|$)/i.test(type)) throw new Error('Unsupported artwork format.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 8 * 1024 * 1024) throw new Error('Artwork is too large.');
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return {data: `data:${type.split(';')[0]};base64,${btoa(binary)}`, url: candidate};
      } catch (error) { failure = error; }
    }
    throw failure;
  })().then(reply, error => reply({error: error.message}));
  return true;
});
chrome.storage?.onChanged?.addListener((changes,area)=>{
  const settings=changes.settings?.newValue;
  if(area==='local'&&settings&&(!settings.enabled||!settings.maxwell))void queueMaxwell(stopMaxwell).catch(()=>{});
});
