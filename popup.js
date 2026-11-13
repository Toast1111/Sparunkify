(() => {
  const S=globalThis.Sparunkify,P=globalThis.SparunkifyPlayers,$=id=>document.getElementById(id);let settings={...S.defaults},timer;
  function sync(){for(const key of ['enabled','inline','motion','parallax','maxwell'])$(key).checked=settings[key];for(const key of ['depth','roughness','shine','sparkle']){$(key).value=settings[key];$(key+'-value').textContent=settings[key]+'%';}$('preset').value=settings.preset;}
  async function save(){try{await chrome.storage.local.set({settings});}catch{$('status').textContent='Could not save settings. Reopen the extension and try again.';}}
  chrome.storage.local.get('settings').then(result=>{settings=S.normalize(result.settings);sync();});
  for(const key of ['enabled','inline','motion','parallax'])$(key).addEventListener('change',()=>{settings[key]=$(key).checked;void save();});
  for(const key of ['depth','roughness','shine','sparkle'])$(key).addEventListener('input',()=>{settings[key]=Number($(key).value);sync();clearTimeout(timer);timer=setTimeout(save,80);});
  $('preset').addEventListener('change',()=>{settings={...settings,preset:$('preset').value,...S.presets[$('preset').value]};sync();void save();});
  async function playerTab(){
    const tabs=await chrome.tabs.query({url:P.patterns});
    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    return tabs.find(tab=>tab.id===active?.id)||tabs.filter(tab=>tab.audible).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0]||tabs.sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];
  }
  function showPlayers(){$('players').hidden=false;$('status').textContent='Open Spotify or YouTube Music and play a track. Sparunkify detects your player automatically.';}
  for(const service of P.players)$('open-'+service.id).addEventListener('click',async()=>{await chrome.tabs.create({url:service.origin+'/'});window.close();});
  async function status(){try{const tab=await playerTab();if(!tab){showPlayers();return;}$('players').hidden=true;const service=P.player(tab.url),state=await chrome.tabs.sendMessage(tab.id,{type:'status'});$('status').textContent=state.detected?service.name+' · '+state.title:'Play a track in '+service.name+' to detect artwork.';}catch{$('status').textContent='Refresh your music player tab after loading this extension.';}}
  $('open').addEventListener('click',async()=>{try{const tab=await playerTab();if(!tab){showPlayers();return;}settings.enabled=true;await save();sync();await chrome.tabs.sendMessage(tab.id,{type:'open'});await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});window.close();}catch{$('status').textContent='Refresh your music player, then try Open artwork view again.';}});
  $('preview').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('preview.html')}));
  $('maxwell').addEventListener('change',async()=>{
    const enabled=$('maxwell').checked;$('maxwell').disabled=true;
    try{
      const [active]=await chrome.tabs.query({active:true,currentWindow:true});
      if(enabled&&!P.player(active?.url))throw Error('Switch to your Spotify or YouTube Music tab, then turn Maxwell on here.');
      const response=await chrome.runtime.sendMessage({type:enabled?'maxwell-start':'maxwell-stop',targetTabId:active?.id});
      if(!response?.ok)throw Error(response?.error||'Could not connect player audio.');
      settings.maxwell=enabled;if(enabled)settings.enabled=true;sync();
      $('status').textContent=enabled?'Maxwell is below the artwork. Music controls his spin and squish.':'Maxwell is off.';
    }catch(error){$('maxwell').checked=settings.maxwell;$('status').textContent=error.message;}
    finally{$('maxwell').disabled=false;}
  });
  sync();void status();
})();
