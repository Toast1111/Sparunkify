// Dependency-free ZIP packaging. Explicit allowlist keeps tests/media out of Chrome.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const files=[...new Set(['manifest.json','PRIVACY.md','THIRD_PARTY_NOTICES.md',manifest.background.service_worker,
  ...manifest.content_scripts.flatMap(entry=>entry.js),manifest.action.default_popup,
  'popup.js','popup.css','preview.html','preview.js','maxwell-offscreen.html','maxwell-offscreen.js','maxwell-cat.js','maxwell-audio.js','maxwell-renderer.js',
  'assets/maxwell/mesh.js','assets/maxwell/dingus_nowhiskers.jpg','assets/maxwell/dingus_whiskers.tga.png',...Object.values(manifest.icons||{})])].sort();
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
for(const file of files){
  if(path.isAbsolute(file)||file.split('/').includes('..'))throw Error('Invalid package path');
  const name=Buffer.from(file),data=fs.readFileSync(path.join(root,file)),crc=crc32(data);
  const entry=Buffer.alloc(30);entry.writeUInt32LE(0x04034b50,0);entry.writeUInt16LE(20,4);
  entry.writeUInt16LE(33,12);entry.writeUInt32LE(crc,14);entry.writeUInt32LE(data.length,18);entry.writeUInt32LE(data.length,22);entry.writeUInt16LE(name.length,26);
  const index=Buffer.alloc(46);index.writeUInt32LE(0x02014b50,0);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);
  index.writeUInt16LE(33,14);index.writeUInt32LE(crc,16);index.writeUInt32LE(data.length,20);index.writeUInt32LE(data.length,24);index.writeUInt16LE(name.length,28);index.writeUInt32LE(offset,42);
  local.push(entry,name,data);central.push(index,name);offset+=entry.length+name.length+data.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...local,directory,end]),out=path.join(root,'dist');fs.mkdirSync(out,{recursive:true});
const name=`sparunkify-${manifest.version}.zip`;fs.writeFileSync(path.join(out,name),zip);
fs.writeFileSync(path.join(out,name+'.sha256'),crypto.createHash('sha256').update(zip).digest('hex')+'  '+name+'\n');
console.log(`${name}: ${files.length} files, ${zip.length} bytes`);
