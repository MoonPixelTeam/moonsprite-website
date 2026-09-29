import fs from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { chromium } from 'playwright';
const [id, file, englishName, priceText] = process.argv.slice(2)
if (!id || !/^[a-z0-9-]+$/.test(id) || !file || !englishName || priceText === undefined || !Number.isFinite(Number(priceText)) || Number(priceText) < 0) {
  throw new Error('Usage: node scripts/import-pets.mjs <slug> <file.mspet> <English name> <CNY price>')
}
const inputs = [[id, file, englishName, Number(priceText)]]
const browser=await chromium.launch({headless:true,channel:"msedge"});const page=await browser.newPage();
const output = 'src/market/importedPets.ts'
const existing = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : ''
const products = existing ? JSON.parse(existing.slice(existing.indexOf('= ') + 2)).filter(product => product.id !== 'pet-' + id) : []
const labels={'idle':['闲置反应','Idle reaction'],'animation.started':['播放动画','Animation started'],'IDLE':['待机','Idle'],'SHOW':['出场','Entrance'],'pet.click':['戳一下','Poke'],'pet.hover':['摸摸','Hover'],'pet.dragging':['拖动','Dragging'],'pet.drag-start':['提起','Pick up'],'pet.drag-end':['放下','Put down'],'history.undo':['撤销反应','Undo reaction'],'document.saved':['保存反应','Save reaction'],'layer.deleted':['删除图层反应','Layer deletion'],'export-complete':['导出完成','Export complete'],'pet.leave':['离开','Leave'],'animation.stopped':['动画停止','Animation stopped'],'project.opened':['打开工程','Open project'],'project.created':['新建工程','New project'],'pet.enter':['出场','Entrance']};
for(const [id,file,en,cny] of inputs){
 const data=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),p=data.pet;
 let png;
 if(data.sprite)png=Buffer.from(data.sprite.split(',')[1],'base64');
 else {const e=data.spriteEncrypted,b=Buffer.from(e.data,'base64'),d=createDecipheriv('aes-256-gcm',Buffer.from('MoonSpritePetKey-v1-20260926-123'),Buffer.from(e.iv,'base64'));d.setAuthTag(b.subarray(-16));png=Buffer.concat([d.update(b.subarray(0,-16)),d.final()]);}
 const root='public/assets/market/'+id;fs.mkdirSync(root,{recursive:true});fs.copyFileSync(file,root+'/pet.mspet');
 const frames=await page.evaluate(async({url,w,h,count})=>{const im=new Image();im.src=url;await im.decode();if(im.width!==w||im.height!==h*count)throw Error('Unexpected sheet size');const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');return Array.from({length:count},(_,i)=>{ctx.clearRect(0,0,w,h);ctx.drawImage(im,0,i*h,w,h,0,0,w,h);return c.toDataURL('image/png').split(',')[1]})},{url:'data:image/png;base64,'+png.toString('base64'),w:p.frameWidth,h:p.frameHeight,count:p.frameCount});
 const sheets={},names={};
 for(const [action,indices] of Object.entries(p.animations)){
  if(!indices.length)continue;
  const dir=root+'/'+action.toLowerCase();fs.mkdirSync(dir,{recursive:true});
  indices.forEach((frame,i)=>fs.writeFileSync(dir+'/'+String(i).padStart(2,'0')+'.png',Buffer.from(frames[frame],'base64')));
  sheets[action]={dir:'/'+dir.replace('public/',''),frames:indices.length,frameWidth:p.frameWidth,frameHeight:p.frameHeight,durations:indices.map(i=>p.durations[i]),duration:indices.reduce((sum,i)=>sum+p.durations[i],0)};
  const event=p.triggerSlots?.find(s=>s.id===action)?.event;const l=labels[event]??labels[action]??['动作 '+(Object.keys(sheets).length),'Action '+Object.keys(sheets).length];names[action]={zh:l[0],en:l[1]};
 }
 const count=Object.keys(sheets).length;
 const bi=(zh,en)=>({zh,en});
 products.unshift({id:'pet-'+id,category:'pets',name:bi(p.name,en),tagline:bi(p.frameCount+' 帧像素动画，陪你一起创作',p.frameCount+' frames of pixel animation'),body:bi(p.name+'宠物包包含 '+count+' 组动画，可安装到软件，也可以在这里预览动作。',en+' includes '+count+' animations. Install the pet in the app or try the animations here.'),price:cny/7.2,size:bi('1 只宠物 · '+count+' 组动画 · '+p.frameCount+' 帧','1 pet · '+count+' animations · '+p.frameCount+' frames'),formats:['.mspet'],download:'/assets/market/'+id+'/pet.mspet',image:sheets.IDLE.dir+'/00.png',animations:{triggers:p.triggerSlots,order:Object.keys(sheets),sheets,labels:names,idle:sheets.IDLE},includes:[bi('可安装的原始 .mspet 宠物包','Original installable .mspet package')],});
}
await browser.close();
fs.writeFileSync('src/market/importedPets.ts',"import type { MarketProduct } from './catalog'\n\nexport const importedPets: MarketProduct[] = "+JSON.stringify(products,null,2)+'\n');

