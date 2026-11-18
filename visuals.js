(() => {
 const $=s=>document.querySelector(s);
 const blue='#1659ae', baselineColor='#70405a', green='#137a43', orange='#b84c0b';
 const fmt=(x,n=1)=>x.toLocaleString('ko-KR',{minimumFractionDigits:n,maximumFractionDigits:n});
 const sum=(r,k)=>r.reduce((n,x)=>n+x[k],0);
 const ticks=[0,6,12,18,24].map(i=>[i,String(i).padStart(2,'0')+':00']);
 function plot(target, {curves,labels,title,highlight,low=0,high,steps=4}){
  const count=curves[0].values.length;
  const W=660,L=54,R=628,T=17,B=157,step=(R-L)/count;
  const y=v=> B-(v-low)/(high-low)*(B-T);
  const x=i=>L+step*i;
  const out=[];
  if(highlight)out.push(`<rect x="${x(highlight[0])}" y="${T}" width="${step*(highlight[1]-highlight[0])}" height="${B-T}" fill="#ffedcd"/>`);
  for(let i=0;i<=steps;i++){
   const v=low+(high-low)*i/steps, pos=y(v);
   out.push(`<line class="grid" x1="${L}" x2="${R}" y1="${pos}" y2="${pos}"/><text x="${L-7}" y="${pos+4}" text-anchor="end">${Number(v.toFixed(1))}</text>`);
  }
  for(const [i,label] of labels)out.push(`<text x="${x(i)}" y="177" text-anchor="middle">${label}</text>`);
  for(const {values,color,dash,kind,name} of curves){
   if(kind==='bars'){
    values.forEach((v,i)=>{
     const pos=Math.min(y(v),y(0));
     const shade=typeof color==='function'?color(v):v<0?orange:v===0?'#64748b':color;
     out.push(`<rect x="${x(i)+step*.14}" y="${pos}" width="${step*.72}" height="${Math.max(1.5,Math.abs(y(v)-y(0)))}" fill="${shade}" opacity=".9"><title>${name} · ${v}</title></rect>`);
    });
   }else{
    const points=values.map((v,i)=>x(i+.5)+','+y(v)).join(' ');
    out.push(`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" ${dash?'stroke-dasharray="7 5"':''}/>`);
    if(count<=7)values.forEach((v,i)=>out.push(`<circle cx="${x(i+.5)}" cy="${y(v)}" r="3.5" fill="${color}"><title>${name} · ${fmt(v,2)}</title></circle>`));
   }
  }
  $(target).innerHTML=`<svg viewBox="0 0 ${W} 189" role="img" aria-label="${title}">${out.join('')}</svg>`;
 }
 const cap=(values,unit)=>Math.max(unit,Math.ceil(Math.max(...values)*1.05/unit)*unit);
 const demoDays = [
  [1.07,.76,-2],[1.03,.94,-1],[1,1,0],[.92,1.05,2],
  [.96,.83,1],[1.04,.92,-1.5],[1.09,.65,-2.5]
 ].map(([heatScale,pvScale,ambientOffset],i)=>{
  const condition={heatScale,pvScale,ambientOffset};
  const ref=P2H.simulate('base',condition), tes=P2H.simulate('solar',condition), ess=P2H.simulate('dr',condition);
  return {date:'2026-01-'+(12+i),hp:sum(ref,'hp'),heat:sum(ref,'output'),noPv:sum(ref,'load'),
   ref:P2H.summary(ref),tes:P2H.summary(tes),ess:P2H.summary(ess)};
 });
 function period(){
  const from=$('#mv-start').value,to=$('#mv-end').value;
  const days=demoDays.filter(d=>d.date>=from&&d.date<=to);
  const key=$('#mv').dataset.selectedMetric??'hp';
  const info={
   hp:{label:'HP 본체 COP',a:'HP 본체 COP',unit:'',va:d=>d.heat/d.hp},
   tes:{label:'HP·보조설비 소비전력량',a:'직접공급',b:'축열운전',unit:'kWh',va:d=>d.ref.energy,vb:d=>d.tes.energy},
   pv:{label:'계통구매전력량',a:'PV 미설치',b:'PV 설치',unit:'kWh',va:d=>d.noPv,vb:d=>d.ref.grid},
   all:{label:'계통구매전력량',a:'주간 축열',b:'주간 축열 + ESS',unit:'kWh',va:d=>d.tes.grid,vb:d=>d.ess.grid}
  }[key];
  $('#mv-bars-heading').textContent=key==='hp'?'기간 성능':'기간 누적 비교';
  if(!from||!to||from>to||!days.length){
   $('#mv-period-note').textContent='예시 자료가 있는 2026-01-12 ~ 2026-01-18 범위에서 시작일과 종료일을 선택하세요.';
   for(const s of ['#mv-trend','#mv-bars','#mv-legend'])$(s).innerHTML='';
   return;
  }
  const a=days.map(info.va),b=info.vb?days.map(info.vb):[];
  const n=days.length;
  $('#mv-period-note').textContent=days[0].date+' ~ '+days.at(-1).date+' · '+n+'일 · '+info.label+(info.unit?' (일별 '+info.unit+')':' (일별 COP)');
  plot('#mv-trend',{curves:[{values:a,color:b.length?baselineColor:blue,dash:!!b.length,name:info.a},...(b.length?[{values:b,color:blue,name:info.b}]:[])],labels:days.map((d,i)=>[i+.5,d.date.slice(5)]),title:info.label+' 일별 비교',high:cap(a.concat(b),key==='hp'?1:100)});
  $('#mv-legend').innerHTML=b.length?`<span class="dash">${info.a}</span><span class="blue">${info.b}</span>`:`<span class="blue">${info.a}</span>`;
  if(key==='hp'){
   const th=sum(days,'heat'),el=sum(days,'hp');
   $('#mv-bars').innerHTML=`<div class="period-cop"><strong>${fmt(th/el,2)}</strong><span>기간 COP · 총 열출력량 ÷ 총 본체 소비전력량</span><small>${fmt(th)} kWhₜₕ ÷ ${fmt(el)} kWh</small></div><p class="subtext">기존 열원 기준자료가 없어 기간 절감량은 산정하지 않습니다.</p>`;
  }else{
   const totalA=a.reduce((s,v)=>s+v,0),totalB=b.reduce((s,v)=>s+v,0),limit=Math.max(totalA,totalB)||1,delta=totalB-totalA;
   const bar=(name,value,css)=>`<div class="period-bar"><div><b>${name}</b><span>${fmt(value)} ${info.unit}</span></div><div class="period-track"><span class="${css}" style="width:${100*value/limit}%"></span></div></div>`;
   $('#mv-bars').innerHTML=bar(info.a,totalA,'baseline')+bar(info.b,totalB,'compared')+`<p class="scope-note">비교 − 기준: <b>${delta>0?'+':''}${fmt(delta)} ${info.unit}</b></p>`;
  }
 }
 $('#mv').addEventListener('mv:change',period);
 for(const s of ['#mv-start','#mv-end'])$(s).addEventListener('change',period);
 const baseline=P2H.simulate('base'), prices=baseline.map(r=>r.tariff);
 const loPrice=Math.min(...prices), hiPrice=Math.max(...prices);
 function dr(){
  const down=$('#dr-direction').value==='down', h=Number($('#dr-start').value), n=Number($('#dr-duration').value);
  const highlight=[h,h+n], key=down?'grid':'hp', unit='kW';
  plot('#tariff-chart',{curves:[{values:prices,color:v=>v===loPrice?green:v===hiPrice?orange:blue,kind:'bars',name:'가정 요금'}],labels:ticks,title:'시간대별 가정 전력량요금',high:260,highlight});
  const low=$('#tariff-low').valueAsNumber,high=$('#tariff-high').valueAsNumber;
  if(!Number.isFinite(low)||!Number.isFinite(high)||low<0||high>500||low>=high){
   $('#tariff-note').textContent='0~500원/kWh 범위에서 저가 기준을 고가 기준보다 낮게 입력하세요.';
   $('#signal-chart').innerHTML='';
  }else{
   const signal=prices.map(v=>v<=low?1:v>=high?-1:0);
   $('#tariff-note').textContent='예시 제어 규칙: '+low+'원/kWh 이하면 증가 유도(+1), '+high+'원/kWh 이상이면 감축 유도(−1), 그 사이는 유지(0).';
   plot('#signal-chart',{curves:[{values:signal,color:green,kind:'bars',name:'제어 권고'}],labels:ticks,title:'요금 기준에 따른 시간대별 제어 권고',low:-1,high:1,steps:2,highlight});
  }
  const ref=baseline.map(r=>r[key]), chosen=P2H.simulate(down?'dr':'solar').map(r=>r[key]);
  const label=down?'계통수전전력':'HP 본체 소비전력';
  $('#response-chart').previousElementSibling.textContent='모의 응동: 기준 운전과 선택 운전 비교 · '+label+' ('+unit+')';
  plot('#response-chart',{curves:[{values:ref,color:baselineColor,dash:true,name:'기준 운전'},{values:chosen,color:blue,name:'선택 모의운전'}],labels:ticks,title:label+'의 기준 운전과 모의운전 비교',high:cap(ref.concat(chosen),10),highlight});
 }
 $('#flex').addEventListener('dr:change',dr);
 for(const s of ['#tariff-high','#tariff-low'])$(s).addEventListener('input',dr);
 period();dr();
})();
