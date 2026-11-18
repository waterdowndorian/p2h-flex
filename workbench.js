(() => {
 const $ = s => document.querySelector(s);
 const num = (x,n=1) => x.toLocaleString('ko-KR',{minimumFractionDigits:n,maximumFractionDigits:n});
 const signed = x => (x>0?'+':'') + num(x);
 const stamp = h => String(h).padStart(2,'0')+':00';
 const readings=(items)=>items.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
 const sums=(a,k)=>a.reduce((s,r)=>s+r[k],0);
 const {fields,inspect,day,displayTime,period}=P2HMeasure;
 const demo = P2H.simulate('dr');
 const keys=Object.keys(fields).filter(k=>!['supply_c','return_c','flow_lpm'].includes(k));
 const valuesFor = r => [r.pv,r.grid,r.export,r.hp,r.aux,r.heat,r.tank,r.battery/24*100,r.output,r.temp,r.charge,r.discharge];
 const sampleDays=[[1.07,.76,-2],[1.03,.94,-1],[1,1,0],[.92,1.05,2],[.96,.83,1],[1.04,.92,-1.5],[1.09,.65,-2.5]];
 const exampleRows=sampleDays.flatMap(([heatScale,pvScale,ambientOffset],i)=>
  P2H.simulate('dr',{heatScale,pvScale,ambientOffset}).map(r=>
   '2026-01-'+(12+i)+'T'+stamp(r.h)+':00+09:00,'+valuesFor(r).map(x=>x.toFixed(3)).join(',')));
 const exampleText=['timestamp,'+keys.join(','),...exampleRows].join('\r\n')+'\r\n';
 let measure=null, request=0, samplePage=0;
 $('#csv-fields').innerHTML=Object.entries(fields).map(([k,[label,unit]])=>`<code>${k}</code> ${label}(${unit})`).join(' · ');
 function reset(text,error=false){
  measure=null;
  $('#measure-result').hidden=true;$('#clear-measure').hidden=true;
  $('#measure-status').textContent=text;$('#measure-status').classList.toggle('error',error);
 }
 function read(text,label){
  measure=inspect(text);
  const d=measure;
  $('#measure-status').textContent=label+(d.rows.length?' · 시각 기준 정렬 완료':' · 사용할 수 있는 시각이 없습니다.');
  $('#measure-status').classList.remove('error');
  $('#measure-result').hidden=false;$('#clear-measure').hidden=false;
  $('#quality-counts').innerHTML=readings([
   ['계측자료 기간 (KST)',d.days.length?d.days[0]+' ~ '+d.days.at(-1):'유효 시각 없음'],
   ['자료가 있는 날짜 / 계측 항목',d.days.length+'일 / '+d.keys.length+'개'],
   ['원본 / 시각 유효 행',num(d.total,0)+' / '+num(d.rows.length,0)],
   ['제외: 중복 / 시각 오류 / 열 불일치',[d.dupe,d.badTime,d.badLength].map(x=>num(x,0)).join(' / ')],
   ['대표 간격(추정) / 긴 공백',d.step?num(d.step/60000,2)+'분 / '+num(d.gaps,0)+'구간':'자료 부족']
  ]);
  const min=d.days[0]??'',max=d.days.at(-1)??'';
  for(const id of ['#measure-from','#measure-to','#measure-day']){
   $(id).min=min;$(id).max=max;$(id).value=id==='#measure-to'?max:min;$(id).disabled=!d.days.length;
  }
  $('#measure-all').disabled=!d.days.length;
  $('#measure-field').innerHTML=d.keys.map(k=>`<option value="${k}">${fields[k][0]} (${fields[k][1]})</option>`).join('');
  if(d.keys.includes('grid_import_kw')) $('#measure-field').value='grid_import_kw';
  $('#measure-quality').innerHTML='<table><caption>계측 항목별 데이터 품질</caption><thead><tr><th scope="col">항목</th><th scope="col">유효값</th><th scope="col">빈 값</th><th scope="col">규칙 위반</th></tr></thead><tbody>'+d.keys.map(k=>{
   const q=d.quality[k];return `<tr><th scope="row">${fields[k][0]}</th><td>${num(q.valid,0)}</td><td>${num(q.missing,0)}</td><td>${num(q.invalid,0)}</td></tr>`;
  }).join('')+'</tbody></table>';
  samplePage=0;renderPeriod();renderMeasurement();
 }
 function renderPeriod(){
  const from=$('#measure-from').value,to=$('#measure-to').value,k=$('#measure-field').value;
  const note=$('#measure-period-note');
  if(!measure?.days.length){
   note.textContent='계측기간을 정할 수 있는 유효 시각이 없습니다.';
   P2HMeasurementCharts.render(null);return;
  }
  const limits=measure.days;
  if(!from||!to||from>to||from<limits[0]||to>limits.at(-1)){
   note.textContent='자료가 있는 범위에서 시작일과 종료일을 순서대로 선택하세요.';
   P2HMeasurementCharts.render(null);return;
  }
  const p=period(measure,k,from,to), [label,unit]=fields[k];
  const n=p.daily.filter(d=>d.n).length;
  const noRecord=p.days-p.daily.length;
  const noValid=p.daily.length-n;
  note.textContent=`${from} ~ ${to} · ${label} · 유효 ${num(p.valid,0)} / ${num(p.total,0)}개 · ${num(n,0)} / ${num(p.days,0)}일에 유효값`
   +(noRecord||noValid?` · 기록 없는 날짜 ${num(noRecord,0)}일 / 유효값 없는 기록일 ${num(noValid,0)}일`:'');
  P2HMeasurementCharts.render(p,label,unit);
  const input=$('#measure-day');
  input.min=from;input.max=to;
  if(!input.value||input.value<from||input.value>to){
   input.value=p.daily.find(d=>d.n)?.date??p.daily[0]?.date??from;
  }
 }
 function showSamples(rows,k){
  const size=24,pages=Math.max(1,Math.ceil(rows.length/size));
  samplePage=Math.min(Math.max(samplePage,0),pages-1);
  const states={valid:'유효',missing:'결측',invalid:'규칙 위반'};
  const selected=rows.slice(samplePage*size,(samplePage+1)*size);
  $('#sample-unit').textContent=fields[k].join(' · ');
  $('#sample-rows').innerHTML=selected.length?selected.map(r=>{
   const v=r.values[k], flag=r.flags[k];
   return `<tr><td>${displayTime(r.t)}</td><td>${v===null?'—':num(v,3)}</td><td><span class="sample-status ${flag}">${states[flag]}</span></td></tr>`;
  }).join(''):'<tr><td colspan="3">선택한 날짜에 계측자료가 없습니다.</td></tr>';
  $('#sample-page').textContent=(samplePage+1)+' / '+pages+' 페이지 · '+rows.length+'행';
  $('#sample-prev').disabled=samplePage===0;
  $('#sample-next').disabled=samplePage+1>=pages;
 }
 function renderMeasurement(){
  if(!measure)return;
  const k=$('#measure-field').value, selectedDay=$('#measure-day').value;
  const rows=measure.rows.filter(r=>day(r.t)===selectedDay);
  const valid=rows.filter(r=>r.values[k]!==null);
  showSamples(rows,k);
  const u=fields[k][1];
  const range=valid.reduce((a,r,i)=>{
   const v=r.values[k];return [Math.min(a[0],v),a[1]*(i/(i+1))+v/(i+1),Math.max(a[2],v)];
  },[Infinity,0,-Infinity]);
  $('#measure-day-label').textContent=fields[k][0]+' · 유효 '+valid.length+' / '+rows.length+'개 · 유효 표본 산술평균(시간가중·사용량 환산 아님)';
  $('#measure-stats').innerHTML=readings(['최솟값','평균','최댓값'].map((s,i)=>[s,valid.length?num(range[i],2)+' '+u:'—']));
  const chart=$('#measure-chart'), note=$('#measure-chart-note');
  if(!valid.length){chart.innerHTML='<p class="empty-chart">이 날짜와 계측 항목에 표시할 유효값이 없습니다.</p>';note.textContent='';return;}
  const start=Date.parse(selectedDay+'T00:00:00+09:00');
  const max=valid.reduce((a,r)=>Math.max(a,r.values[k]),0);
  const lower=valid.reduce((a,r)=>Math.min(a,r.values[k]),0);
  const upper=k==='ess_soc_pct'?100:max||1;
  const x=t=>66+Math.min(1,(t-start)/86400000)*720;
  const y=v=>161-142*(v/2-lower/2)/(upper/2-lower/2);
  let path='', previous=null;
  const dots=[];
  for(const r of rows){
   const v=r.values[k];if(v===null){previous=null;continue;}
   const join=previous!==null&&(!measure.step||r.t-previous<=1.5*measure.step);
   path+=(join?'L':'M')+x(r.t).toFixed(2)+','+y(v).toFixed(2);
   if(valid.length<=96||!join) dots.push(`<circle cx="${x(r.t)}" cy="${y(v)}" r="3.2" fill="#087481"><title>${displayTime(r.t)} · ${num(v,2)} ${fields[k][1]}</title></circle>`);
   previous=r.t;
  }
  const grid=Array.from({length:5},(_,i)=>{const v=i/4*upper+(1-i/4)*lower;return `<line class="grid" x1="66" x2="786" y1="${y(v)}" y2="${y(v)}"/><text x="58" y="${y(v)+4}" text-anchor="end">${Math.abs(v)>=1e5||v!==0&&Math.abs(v)<.01?v.toExponential(1):num(v,2)}</text>`;}).join('');
  const ticks=[0,6,12,18,24].map(h=>`<text x="${66+30*h}" y="181" text-anchor="middle">${stamp(h)}</text>`).join('');
  chart.innerHTML=`<svg viewBox="0 0 810 197" role="img" aria-label="${fields[k][0]} 계측값 시간 그래프"><title>${fields[k][0]} (${fields[k][1]})</title>${grid}${ticks}<path d="${path}" fill="none" stroke="#087481" stroke-width="3"/>${dots.join('')}</svg>`;
  note.textContent='KST · '+valid.length+'개 유효값 · 첫 시각 '+displayTime(valid[0].t)+' · 마지막 시각 '+displayTime(valid.at(-1).t)+' · 긴 공백과 결측은 선을 연결하지 않음';
 }
 $('#measure-file').addEventListener('change',async event=>{
  const selected=event.target.files?.[0];if(!selected)return;
  const token=++request;
  reset('파일을 확인하는 중입니다.');
  if(selected.size>2000000){reset('파일은 2 MB 이하여야 합니다.',true);event.target.value='';return;}
  try{
   const contents=await selected.text();
   if(token===request)read(contents,'사용자 제공 CSV · '+selected.name);
  }catch(error){if(token===request)reset(error.message,true);}
  if(token===request)event.target.value='';
 });
 $('#load-sample').addEventListener('click',()=>{request++;read(exampleText,'모의 예시 · 실측 아님');});
 $('#clear-measure').addEventListener('click',()=>{request++;reset('자료를 지웠습니다. 새 CSV를 불러올 수 있습니다.');});
 $('#save-sample').addEventListener('click',()=>{
  const a=document.createElement('a'), url=URL.createObjectURL(new Blob(['\uFEFF',exampleText],{type:'text/csv;charset=utf-8'}));
  a.href=url;a.download='p2h_measurement_example.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 const updatePeriod=()=>{samplePage=0;renderPeriod();renderMeasurement();};
 for(const id of ['#measure-from','#measure-to','#measure-field'])$(id).addEventListener('change',updatePeriod);
 $('#measure-all').addEventListener('click',()=>{
  if(!measure?.days.length)return;
  $('#measure-from').value=measure.days[0];$('#measure-to').value=measure.days.at(-1);
  updatePeriod();
 });
 $('#measure-day').addEventListener('change',()=>{
  const input=$('#measure-day');
  if(!input.value||input.value<input.min||input.value>input.max)input.value=input.min;
  samplePage=0;renderMeasurement();
 });
 $('#sample-prev').addEventListener('click',()=>{samplePage--;renderMeasurement();});
 $('#sample-next').addEventListener('click',()=>{samplePage++;renderMeasurement();});

 const normal=P2H.simulate('base'), solar=P2H.simulate('solar');
 const base=P2H.summary(normal), shifted=P2H.summary(solar), combo=P2H.summary(demo);
 const mv={
  hp:['기존 열원 → 히트펌프','동일한 유효 열공급량과 운전조건에서 기존 설비의 에너지 사용량을 기준으로 비교합니다.',[
   ['HP 본체 열생산량',num(sums(normal,'output'))+' kWhₜₕ'],['HP 본체 소비전력량',num(sums(normal,'hp'))+' kWh'],['기간 HP COP',num(sums(normal,'output')/sums(normal,'hp'),2)]
  ],'기존 열원의 연료·전력 사용량이 없어 도입 절감량은 산정하지 않습니다. 위 COP는 본체만의 모의 성능입니다.'],
  tes:['직접공급 → 주간 축열','같은 유효 열공급량과 외기온도에서 직접공급과 축열운전을 비교합니다. 저장손실과 보조전력을 포함합니다.',[
   ['유효 열공급량 (두 운전 동일)',num(sums(solar,'heat'))+' kWhₜₕ'],['기준 / 축열 소비전력량',num(base.energy)+' / '+num(shifted.energy)+' kWh'],['설비 소비전력량 변화',signed(shifted.energy-base.energy)+' kWh']
  ],'계통 수전량이 감소하더라도 설비 소비전력량이 늘었다면 에너지절감으로 분류하지 않습니다.'],
  pv:['동일 부하의 PV 미설치 → PV 설치','ESS가 대기하는 기준운전에서 동일 부하를 놓고, PV가 없었을 때의 수전량과 비교합니다. 계통 역송은 대체량에서 제외합니다.',[
   ['PV 발전량',num(sums(normal,'pv'))+' kWh'],['직접 자가소비량',num(base.self)+' kWh'],['계통구매전력 대체량',num(sums(normal,'load')-base.grid)+' kWh']
  ],'계통구매전력 대체량은 최종 에너지소비 절감량이나 EERS 인정량과 같지 않습니다.'],
  all:['주간 축열 → 주간 축열 + ESS','PV 발전과 축열 스케줄은 그대로 두고, 남은 PV로 충전한 ESS를 저녁에 방전합니다. 따라서 아래는 ESS 연계의 추가 변화입니다.',[
   ['PV 자가소비량 변화',signed(combo.self-shifted.self)+' kWh'],['계통구매전력량 변화',signed(combo.grid-shifted.grid)+' kWh'],['최대 수전전력 변화',signed(combo.peak-shifted.peak)+' kW']
  ],'ESS 기여량은 축열·PV 도입 효과와 구분합니다. ESS 충·방전 손실은 자가소비량에서 제외합니다.']
 };
 function showMv(key){
  const [title,desc,list,note]=mv[key];
  for(const b of document.querySelectorAll('[data-mv]'))b.setAttribute('aria-pressed',b.dataset.mv===key);
  $('#mv').dataset.selectedMetric=key;
  $('#mv-result').innerHTML=`<h3>${title}</h3><p class="subtext">${desc}</p><dl class="readouts">${readings(list)}</dl><p class="scope-note">${note}</p>`;
  $('#mv').dispatchEvent(new Event('mv:change'));
 }
 for(const b of document.querySelectorAll('[data-mv]'))b.addEventListener('click',()=>showMv(b.dataset.mv));
 showMv('hp');

 const direction=$('#dr-direction'), start=$('#dr-start'), duration=$('#dr-duration');
 const option=(v,s)=>`<option value="${v}">${s}</option>`;
 function renderDr(){
  const down=direction.value==='down', h=Number(start.value), n=Number(duration.value);
  const scenario=down?demo:solar;
  const key=down?'grid':'hp';
  const steps=normal.slice(h,h+n).map((r,i)=>down?r[key]-scenario[h+i][key]:scenario[h+i][key]-r[key]);
  const energy=steps.reduce((a,b)=>a+b,0);
  $('#dr-boundary').textContent=down?'계측경계: 계통수전(M02) · 기준운전 vs 주간 축열+ESS.':'계측경계: 히트펌프 본체(M03) · 기준운전 vs 주간 축열. HP 전력 증가는 계통수전 증가와 같지 않을 수 있습니다.';
  $('#dr-result').innerHTML=readings([
   ['평가 구간',stamp(h)+'–'+stamp(h+n)],
   ['평균 '+(down?'수전 감축':'HP 수요 증가'),num(energy/n)+' kW'],
   ['구간 '+(down?'수전 감축량':'HP 추가 사용량'),num(energy)+' kWh']
  ]);
  $('#flex').dispatchEvent(new Event('dr:change'));
 }
 function resetDuration(full=false){
  const end=direction.value==='down'?22:15;
  const max=end-Number(start.value), old=full?max:Number(duration.value)||max;
  duration.innerHTML=Array.from({length:max},(_,i)=>option(i+1,i+1+'시간')).join('');
  duration.value=String(Math.min(old,max));renderDr();
 }
 function resetDr(){
  const first=direction.value==='down'?18:11;
  start.innerHTML=Array.from({length:4},(_,i)=>option(first+i,stamp(first+i))).join('');
  resetDuration(true);
 }
 direction.addEventListener('change',resetDr);start.addEventListener('change',()=>resetDuration());duration.addEventListener('change',renderDr);
 resetDr();
})();
