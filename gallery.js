(() => {
 const $=s=>document.querySelector(s);
 const slides=[
  {title:'대화형 논리 구성도'},
  {title:'P2X 제어 연계 · 개념도',src:'assets/p2x-control-demo.svg'},
  {title:'P2X 에너지 계측점 · 개념도',src:'assets/p2x-meter-demo.svg'}
 ];
 const stored=new Map(), revisions=new Map();
 const extras=[];
 const format=['image/png','image/jpeg','image/webp'];
 const validFile=blob=>format.includes(blob.type)&&blob.size<=8000000;
 const photo=$('#diagram-image'), file=$('#diagram-file'), status=$('#diagram-status');
 const dialog=$('#diagram-dialog'), large=$('#diagram-large');
 const topology=photo.closest('.topology'), monitor=$('#monitor');
 const button=(label,id)=>{
  const el=document.createElement('button');
  el.type='button';el.className='action';el.id=id;el.textContent=label;
  return el;
 };
 const toggle=button('자동 전환 끄기','diagram-autoplay');
 $('#diagram-next').after(toggle);
 const add=button('이미지 여러 장 추가','diagram-add');
 const remove=button('이 이미지 삭제','diagram-remove');
 $('#diagram-full').before(add,remove);
 const multi=document.createElement('input');
 multi.type='file';multi.accept=file.accept;multi.multiple=true;multi.hidden=true;
 file.after(multi);
 const frame=$('#diagram-position');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let index=0, requested=0, autoplay=!reduced.matches, timer=null;
 let hovering=false, focused=false, busy=false;
 const db=new Promise((resolve,reject)=>{
  // GitHub Pages projects under one account can share an origin.
  const folder=location.pathname.replace(/index\.html$/,'');
  const req=indexedDB.open('p2h-flex-gallery:'+folder,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('drawings');
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
 async function access(mode,work){
  const conn=await db;
  return new Promise((resolve,reject)=>{
   const tx=conn.transaction('drawings',mode), req=work(tx.objectStore('drawings'));
   tx.oncomplete=()=>resolve(req.result);
   tx.onabort=()=>reject(tx.error);
   tx.onerror=()=>reject(tx.error);
  });
 }
 const localSlides=()=>slides.concat(extras);
 function autoplayState(){
  toggle.textContent=autoplay?'자동 전환 끄기':'자동 전환 켜기';
  frame.setAttribute('aria-live',autoplay?'off':'polite');
  schedule();
 }
 function schedule(){
  clearTimeout(timer);
  if(!autoplay||hovering||focused||busy||dialog.open||document.hidden||monitor.hidden||localSlides().length<2)return;
  timer=setTimeout(()=>move(1,true),5000);
 }
 function show(){
  const list=localSlides(), slide=list[index], custom=stored.get(index), isDrawing=Boolean(slide.src);
  $('#diagram-interactive').hidden=isDrawing;
  $('#diagram-photo').hidden=!isDrawing;
  $('#diagram-full').hidden=!isDrawing;
  $('#diagram-reset').hidden=!custom;
  remove.hidden=!slide.local;
  $('#replace-diagram').disabled=Boolean(slide.local||slide.shared);
  frame.textContent=(index+1)+' / '+list.length;
  $('#diagram-caption').textContent=slide.title+(slide.local||custom?' · 이 브라우저에만 저장':'');
  const upload=$('#replace-diagram span');
  if(upload)upload.textContent=slide.local?'이 브라우저에서 추가한 이미지':slide.shared?'GitHub에 등록된 공용 도면':'이미지를 눌러 이 브라우저에서 교체';
  if(isDrawing){photo.src=custom?.url??slide.src;photo.alt=slide.title;}
 }
 function put(slot,blob){
  const old=stored.get(slot);
  if(old)URL.revokeObjectURL(old.url);
  stored.set(slot,{url:URL.createObjectURL(blob)});
 }
 for(const slot of [1,2]){
  access('readonly',s=>s.get(slot)).then(blob=>{
   if(blob instanceof Blob&&!revisions.has(slot)){put(slot,blob);if(index===slot)show();}
  }).catch(()=>{});
 }
 const ready=access('readonly',s=>s.get('extra-gallery-v1')).then(saved=>{
  for(const item of Array.isArray(saved)?saved.slice(0,12):[]){
   if(item?.blob instanceof Blob&&validFile(item.blob)&&typeof item.title==='string'){
    extras.push({...item,src:URL.createObjectURL(item.blob),local:true});
   }
  }
  show();
 }).catch(()=>{});
 const selectedPath=/^[\w-][\w.-]{0,120}\.(?:png|jpe?g|webp|svg)$/i;
 fetch('assets/gallery-slides.json',{cache:'no-cache'}).then(r=>r.ok?r.json():[]).then(items=>{
  if(!Array.isArray(items))return;
  const selected=localSlides()[index];
  const names=new Set();
  for(const item of items.slice(0,30)){
   if(typeof item?.file!=='string'||!selectedPath.test(item.file)||names.has(item.file))continue;
   names.add(item.file);
   slides.push({title:typeof item.title==='string'&&item.title.trim()?item.title.trim().slice(0,100):item.file,src:'assets/gallery/'+item.file,shared:true});
  }
  index=Math.max(0,localSlides().indexOf(selected));show();schedule();
 }).catch(()=>{});
 function move(offset,automatic=false){
  const length=localSlides().length;
  index=(index+offset+length)%length;show();
  if(!automatic)status.textContent=index?'직접 추가하거나 교체한 도면은 이 브라우저에만 보관됩니다.':'가상 계측점을 선택하면 모의 계측값을 볼 수 있습니다.';
  schedule();
 }
 $('#diagram-prev').addEventListener('click',()=>move(-1));
 $('#diagram-next').addEventListener('click',()=>move(1));
 toggle.addEventListener('click',()=>{autoplay=!autoplay;autoplayState();});
 topology.addEventListener('mouseenter',()=>{hovering=true;schedule();});
 topology.addEventListener('mouseleave',()=>{hovering=false;schedule();});
 topology.addEventListener('focusin',()=>{focused=true;schedule();});
 topology.addEventListener('focusout',e=>{focused=topology.contains(e.relatedTarget);schedule();});
 document.addEventListener('visibilitychange',schedule);
 window.addEventListener('hashchange',schedule);
 dialog.addEventListener('close',schedule);
 function decode(blob){
  const url=URL.createObjectURL(blob);
  const probe=new Image();probe.src=url;
  return probe.decode().then(()=>{
   if(probe.naturalWidth*probe.naturalHeight>36000000)throw new Error();
  }).finally(()=>URL.revokeObjectURL(url));
 }
 async function persistExtras(){
  await access('readwrite',s=>s.put(extras.map(({blob,title})=>({blob,title})),'extra-gallery-v1'));
 }
 add.addEventListener('click',()=>multi.click());
 multi.addEventListener('change',async ()=>{
  const picked=Array.from(multi.files);multi.value='';
  if(!picked.length||busy)return;
  busy=true;add.disabled=true;remove.disabled=true;schedule();
  try{
   await ready;
   let accepted=0;
   for(const blob of picked){
    if(extras.length===12)break;
    if(!validFile(blob))continue;
    try{await decode(blob);}catch{continue;}
    extras.push({blob,title:blob.name.replace(/\.[^.]+$/,'').slice(0,100),src:URL.createObjectURL(blob),local:true});
    accepted++;
   }
   if(!accepted){status.textContent='추가하지 못했습니다. 최대 12장, PNG·JPG·WebP, 장당 8 MB 이내입니다.';return;}
   index=localSlides().length-accepted;
   show();
   const skipped=picked.length-accepted;
   const message=accepted+'장 추가'+(skipped?' · '+skipped+'장 제외(파일 조건 또는 최대 12장)':'');
   try{await persistExtras();status.textContent=message+' · 이 브라우저에만 저장됩니다.';}
   catch{status.textContent=message+' · 저장 공간이 부족하거나 제한되어 새로고침 후 유지되지 않을 수 있습니다.';}
  }finally{busy=false;add.disabled=false;remove.disabled=false;schedule();}
 });
 remove.addEventListener('click',async ()=>{
  const item=localSlides()[index];
  if(!item.local||busy)return;
  busy=true;add.disabled=true;remove.disabled=true;schedule();
  const i=extras.indexOf(item);
  extras.splice(i,1);
  try{
   await persistExtras();URL.revokeObjectURL(item.src);
   status.textContent='이 브라우저에 저장한 이미지를 삭제했습니다.';
  }catch{
   extras.splice(i,0,item);
   status.textContent='저장 공간에 접근하지 못해 이미지를 삭제하지 못했습니다.';
  }finally{index=Math.min(index,localSlides().length-1);show();busy=false;add.disabled=false;remove.disabled=false;schedule();}
 });
 $('#replace-diagram').addEventListener('click',()=>{requested=index;file.click();});
 file.addEventListener('change',async ()=>{
  const blob=file.files?.[0], slot=requested;file.value='';
  if(!blob)return;
  if(!validFile(blob)){status.textContent='PNG·JPG·WebP, 8 MB 이하의 이미지를 선택하세요.';return;}
  const ticket=(revisions.get(slot)??0)+1;revisions.set(slot,ticket);
  try{
   await decode(blob);
  }catch{if(revisions.get(slot)===ticket)status.textContent='이미지를 읽을 수 없거나 해상도가 너무 큽니다.';return;}
  if(revisions.get(slot)!==ticket)return;
  put(slot,blob);show();
  try{
   await access('readwrite',s=>s.put(blob,slot));
   if(revisions.get(slot)===ticket)status.textContent='교체 완료 · 이 브라우저에서 다시 열어도 유지됩니다.';
  }catch{if(revisions.get(slot)===ticket)status.textContent='교체는 완료됐지만 저장할 수 없어 현재 화면에만 유지됩니다.';}
 });
 $('#diagram-reset').addEventListener('click',async ()=>{
  const slot=index, old=stored.get(slot);
  const ticket=(revisions.get(slot)??0)+1;revisions.set(slot,ticket);
  try{await access('readwrite',s=>s.delete(slot));}
  catch{if(revisions.get(slot)===ticket)status.textContent='저장본을 지우지 못했습니다. 현재 화면에서 기본 도면으로 돌아갑니다.';}
  if(revisions.get(slot)!==ticket)return;
  if(old)URL.revokeObjectURL(old.url);
  stored.delete(slot);show();
  if(!status.textContent.includes('지우지 못'))status.textContent='기본 도면으로 복원했습니다.';
 });
 $('#diagram-full').addEventListener('click',()=>{large.src=photo.src;large.alt=photo.alt;dialog.showModal();schedule();});
 show();autoplayState();
})();
