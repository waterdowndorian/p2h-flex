const qs = s => document.querySelector(s);
const qa = s => [...document.querySelectorAll(s)];
const modes = ['base','solar','dr'];
const profiles = Object.fromEntries(modes.map(mode => [mode, P2H.simulate(mode)]));
const reference = P2H.summary(profiles.base);
const fmt = (x, n=1) => x.toLocaleString('ko-KR',{minimumFractionDigits:n,maximumFractionDigits:n});
const clock = h => String(h).padStart(2,'0') + ':00';
const metrics = [
 ['HP·보조설비 소비전력량','energy','kWh',1],
 ['PV 자가소비량','self','kWh',1],
 ['계통 구매전력량','grid','kWh',1],
 ['최대 계통수전전력','peak','kW',1],
 ['예시 전력량요금','cost','원',0]
];
const notes = {
 base:'기준운전: PV는 가동하고 HP는 열수요를 직접 충족합니다. TES·ESS는 대기 상태입니다.',
 solar:'주간 축열: 11–14시에 HP로 추가 생산한 열을 저장하고, 18–21시 열부하에 저장열을 우선 공급합니다. PV 발전이 부족하면 계통전력을 사용합니다.',
 dr:'피크시간 DR: 같은 축열 일정에 더해, 남은 PV 발전전력으로 ESS를 충전하고 18–21시에 방전합니다. 시장 지령이 아닌 모의 이벤트입니다.'
};
const meters = [
 ['M01','PV 발전',190,134, r=>[['PV 발전',r.pv,'kW'],['PV 직접소비',Math.min(r.pv,r.load),'kW'],['계통 역송',r.export,'kW']]],
 ['M02','계통 수전·역송',640,134,r=>[['계통 수전',r.grid,'kW'],['계통 역송',r.export,'kW'],['예시 전력량 단가',r.tariff,'원/kWh']]],
 ['M03','히트펌프·보조설비',525,192,r=>[['HP 소비전력',r.hp,'kW'],['보조설비 전력',r.aux,'kW'],['HP COP',r.cop,''],['외기온도',r.temp,'°C']]],
 ['M04','ESS 충·방전',296,188,r=>[['충전 입력',r.charge,'kW'],['방전 출력',r.discharge,'kW'],['저장전력량',r.battery,'kWh'],['SOC',r.battery/24*100,'%']]],
 ['M05','현장 기타부하',416,190,r=>[['기타부하',r.base,'kW'],['현장 총소비전력',r.load,'kW']]],
 ['M06','열공급·축열',677,286,r=>[['HP 열출력',r.output,'kWₜₕ'],['수요처 공급열',r.heat,'kWₜₕ'],['축열 입력',r.store,'kWₜₕ'],['방열 출력',r.release,'kWₜₕ'],['저장열량',r.tank,'kWhₜₕ']]]
];
let mode='solar', hour=12, meter=2;
qs('#meters').innerHTML = meters.map(([id,name,x,y],i)=>`<g class="meter" data-meter="${i}" role="button" tabindex="0" aria-label="${id} ${name}" transform="translate(${x} ${y})"><rect class="tag" x="-19" y="-10" width="38" height="20" rx="8"/><text text-anchor="middle" y="4">${id}</text></g>`).join('');
qs('#meter-shortcuts').innerHTML = meters.map(([id,name],i)=>`<button data-meter="${i}" aria-label="${id} ${name}">${id}</button>`).join('');
for(const el of qa('[data-meter]')){
 const select = () => {meter=Number(el.dataset.meter);showMeter();};
 el.addEventListener('click',select);
 if(el.tagName.toLowerCase()!=='button') el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
}
function showMeter(){
 const [id,name,,,fields]=meters[meter];
 qs('#meter-title').textContent = id+' · '+name;
 qs('#meter-data').innerHTML = '<dl>'+fields(profiles[mode][hour]).map(([label,value,unit])=>`<div><dt>${label}</dt><dd>${fmt(value)} ${unit}</dd></div>`).join('')+'</dl>';
 qs('#hour-label').textContent=clock(hour)+'–'+clock(hour+1);
 for(const el of qa('[data-meter]')){const active=Number(el.dataset.meter)===meter;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',active);}
}
function chart(target, series, isThermal=false){
 const left=42,right=isThermal?530:543,top=14,bottom=147;
 const yMax=isThermal?80:60, rMax=80;
 const x=h=>left+(right-left)*h/24;
 const y=(v,max)=>bottom-(bottom-top)*v/max;
 const svg = [];
 svg.push(`<rect class="hoursel" x="${x(hour)}" y="${top}" width="${x(1)-x(0)}" height="${bottom-top}"/>`);
 for(let i=0;i<=4;i++){
   const level=yMax*i/4, py=y(level,yMax);
   svg.push(`<line class="grid" x1="${left}" x2="${right}" y1="${py}" y2="${py}"/><text x="${left-6}" y="${py+4}" text-anchor="end">${level}</text>`);
   if(isThermal) svg.push(`<text x="${right+6}" y="${py+4}">${rMax*i/4}</text>`);
 }
 for(let h=0;h<=24;h+=6) svg.push(`<text x="${x(h)}" y="169" text-anchor="middle">${clock(h)}</text>`);
 for(const [values,color,dashed,secondary,shade] of series){
   if(!shade)continue;
   const max=secondary?rMax:yMax;
   const points=values.map((v,h)=>x(h+.5).toFixed(1)+','+y(v,max).toFixed(1)).join(' ');
   svg.push(`<polygon points="${x(.5)},${bottom} ${points} ${x(23.5)},${bottom}" fill="${color}" opacity=".13"/>`);
 }
 for(const [values,color,dashed,secondary] of series){
   const max=secondary?rMax:yMax;
   const points=values.map((v,h)=>x(h+0.5).toFixed(1)+','+y(v,max).toFixed(1)).join(' ');
   svg.push(`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${dashed?2.4:3}" ${dashed?'stroke-dasharray="7 5"':''}/><circle cx="${x(hour+0.5)}" cy="${y(values[hour],max)}" r="3.6" fill="${color}" stroke="white"/>`);
 }
 qs(target).innerHTML = `<svg viewBox="0 0 574 177" role="img" aria-label="${isThermal?'24시간 열출력과 축열량':'24시간 전력 시나리오 비교'}">${svg.join('')}</svg>`;
}
function renderCharts(){
 const rows=profiles[mode], col=k=>rows.map(r=>r[k]);
 const current=[col('grid'),'#1659ae'];
 const baseline=[profiles.base.map(r=>r.grid),'#70405a',true];
 chart('#electric',[current,baseline,[col('pv'),'#137a43',false,false,true],[col('hp'),'#b84c0b']]);
 chart('#thermal',[[col('output'),'#b84c0b'],[col('heat'),'#137a43'],[col('tank'),'#1659ae',false,true,true]],true);
}
function update(){
 const stats=P2H.summary(profiles[mode]);
 for(const b of qa('[data-mode]')) b.setAttribute('aria-pressed',b.dataset.mode===mode);
 qs('#kpis').innerHTML=metrics.map(([label,key,unit,n])=>{
  const delta=stats[key]-reference[key];
  const sign=Math.abs(delta)<.5*10**(-n)?'':delta>0?'+':'−';
  return `<article class="kpi"><h2>${label}</h2><p>${fmt(stats[key],n)}<span>${unit}</span></p><small>${mode==='base'?'기준운전': '기준 대비 '+sign+fmt(Math.abs(delta),n)+' '+unit}</small></article>`;
 }).join('');
 qs('#scenario-note').textContent=notes[mode];
 showMeter(); renderCharts();
}
for(const b of qa('[data-mode]')) b.addEventListener('click',()=>{mode=b.dataset.mode;update();});
qs('#hour').addEventListener('input',e=>{hour=Number(e.target.value);showMeter();renderCharts();});
function navigate(){
 const requested=location.hash.slice(1);
 const page=['monitor','mv','flex','data'].includes(requested)?requested:'monitor';
 for(const el of qa('.page')) el.hidden=el.id!==page;
 for(const a of qa('[data-page]')) a.dataset.page===page?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');
}
window.addEventListener('hashchange',()=>{navigate();window.scrollTo(0,0);});
update(); navigate();
