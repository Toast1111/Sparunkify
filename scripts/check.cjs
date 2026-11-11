const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
if(manifest.manifest_version!==3)throw Error('Manifest V3 is required.');
for(const file of ['artwork.js','engine.js','spotify-theme.js','surface.js','content.js','background.js','popup.js','preview.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
for(const file of [manifest.background.service_worker,manifest.action.default_popup,...manifest.content_scripts.flatMap(x=>x.js)])if(!fs.existsSync(path.join(root,file)))throw Error('Missing '+file);
console.log('Manifest references and JavaScript syntax verified.');
