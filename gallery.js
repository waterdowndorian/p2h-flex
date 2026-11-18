(() => {
 const $=s=>document.querySelector(s);
 const slides=[
  {title:'대화형 논리 구성도'},
  {title:'P2X 제어 연계 · 개념도',src:'assets/p2x-control-demo.svg'},
  {title:'P2X 에너지 계측점 · 개념도',src:'assets/p2x-meter-demo.svg'}
 ];
 const stored=new Map(), revisions=new Map();
 const photo=$('#diagram-image'), file=$('#diagram-file'), status=$('#diagram-status');
 const dialog=$('#diagram-dialog'), large=$('#diagram-large');
 let index=0, requested=0;
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
 function show(){
  const slide=slides[index], custom=stored.get(index), isDrawing=Boolean(slide.src);
  $('#diagram-interactive').hidden=isDrawing;
  $('#diagram-photo').hidden=!isDrawing;
  $('#diagram-full').hidden=!isDrawing;
  $('#diagram-reset').hidden=!custom;
  $('#diagram-position').textContent=(index+1)+' / '+slides.length;
  $('#diagram-caption').textContent=slide.title+(custom?' · 교체 이미지':'');
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
 function move(offset){
  index=(index+offset+slides.length)%slides.length;show();
  status.textContent=index?'교체한 도면은 이 브라우저에만 보관됩니다.':'가상 계측점을 선택하면 해당 시각의 모의 계측값을 볼 수 있습니다.';
 }
 $('#diagram-prev').addEventListener('click',()=>move(-1));
 $('#diagram-next').addEventListener('click',()=>move(1));
 $('#replace-diagram').addEventListener('click',()=>{requested=index;file.click();});
 file.addEventListener('change',async ()=>{
  const blob=file.files?.[0], slot=requested;file.value='';
  if(!blob)return;
  if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>8000000){status.textContent='PNG·JPG·WebP, 8 MB 이하의 이미지를 선택하세요.';return;}
  const ticket=(revisions.get(slot)??0)+1;revisions.set(slot,ticket);
  const url=URL.createObjectURL(blob);
  try{
   const probe=new Image();probe.src=url;await probe.decode();
   if(probe.naturalWidth*probe.naturalHeight>36000000)throw new Error();
  }catch{if(revisions.get(slot)===ticket)status.textContent='이미지를 읽을 수 없거나 해상도가 너무 큽니다.';return;}
  finally{URL.revokeObjectURL(url);}
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
 $('#diagram-full').addEventListener('click',()=>{large.src=photo.src;large.alt=photo.alt;dialog.showModal();});
 show();
})();
