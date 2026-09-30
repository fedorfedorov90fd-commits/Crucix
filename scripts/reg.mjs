import { readFile, writeFile } from 'fs/promises';
const s = '/home/ta8_/Рабочий стол/Crucix/server';

// modules.json — массив [{id, path}]
let m = JSON.parse(await readFile(s+'/modules.json','utf-8'));
if(!m.find(a=>a.id==='map-layer-vix')){
  m.push({id:'map-layer-vix',path:'./apis/sources/map-layer-vix'});
  await writeFile(s+'/modules.json',JSON.stringify(m,null,2));
  console.log('✅ modules.json');
}

// routes-api.json — объект {"/path": "module"}
let r = JSON.parse(await readFile(s+'/routes-api.json','utf-8'));
if(!r['/api/map-layer-vix/']){
  r['/api/map-layer-vix/'] = 'map-layer-vix';
  await writeFile(s+'/routes-api.json',JSON.stringify(r,null,2));
  console.log('✅ routes-api.json');
}

// pages.json — массив [{id, file}]
let p = JSON.parse(await readFile(s+'/pages.json','utf-8'));
if(!p.find(a=>a.id==='map-layer-vix')){
  p.push({id:'map-layer-vix',file:'map-layer-vix.html'});
  await writeFile(s+'/pages.json',JSON.stringify(p,null,2));
  console.log('✅ pages.json');
}

console.log('✅ Регистрация завершена');
