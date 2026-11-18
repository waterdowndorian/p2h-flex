(function(root){
 const fields = {
  pv_kw:['PV 발전','kW'], grid_import_kw:['계통 수전','kW'],
  grid_export_kw:['계통 역송','kW'], hp_kw:['HP 소비전력','kW'],
  aux_kw:['보조설비 소비전력','kW'], heat_kwth:['유효 열공급','kWₜₕ'],
  tes_kwhth:['TES 저장열량','kWhₜₕ'], ess_soc_pct:['ESS SOC','%'],
  hp_heat_kwth:['HP 열출력','kWₜₕ'], ambient_c:['외기온도','°C'],
  supply_c:['공급수온','°C'], return_c:['환수온도','°C'],
  flow_lpm:['순환유량','L/min'], ess_charge_kw:['ESS 충전','kW'], ess_discharge_kw:['ESS 방전','kW']
 };
 const temperature=new Set(['ambient_c','supply_c','return_c']);
 function parse(text) {
  const rows=[]; let row=[], cell='', quoted=false, closed=false, line=1;
  text=text.replace(/^\uFEFF/,'');
  const push=()=>{row.push(cell.trim());cell='';closed=false;};
  const finish=()=>{push();if(row.some(Boolean))rows.push(row);row=[];};
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){
    if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
    else cell+=c;
   }else if(c===','){push();}
   else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finish();line++;}
   else if(c==='"'&&!cell&&!closed){quoted=true;}
   else if(closed||c==='"'){throw new Error('CSV 따옴표 형식을 확인하세요. (행 '+line+')');}
   else cell+=c;
  }
  if(quoted)throw new Error('CSV에 닫히지 않은 따옴표가 있습니다.');
  if(row.length||cell||closed)finish();
  return rows;
 }
 const day = t => new Date(t + 9*3600000).toISOString().slice(0,10);
 const displayTime = t => new Date(t + 9*3600000).toISOString().slice(11,19);
 function time(s) {
  const m=s?.match(/^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::(\d\d)(\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)?$/);
  if(!m)return NaN;
  const [,yr,mo,dd,h,mm,ss='00',frac='',tz='+09:00']=m;
  if(+yr<1900||+yr>2099||+mo<1||+mo>12||+dd<1||+dd>31||+h>23||+mm>59||+ss>59)return NaN;
  if(new Date(Date.UTC(+yr,+mo-1,+dd)).getUTCDate()!==+dd)return NaN;
  return Date.parse(yr+'-'+mo+'-'+dd+'T'+h+':'+mm+':'+ss+frac+tz);
 }
 function inspect(text){
  const [header,...input]=parse(text);
  if(!header||!input.length)throw new Error('헤더와 데이터 행이 있는 CSV가 필요합니다.');
  if(input.length>50000)throw new Error('한 번에 50,000행까지 분석할 수 있습니다.');
  if(new Set(header).size!==header.length)throw new Error('같은 이름의 열이 두 개 이상 있습니다.');
  const stamp=header.indexOf('timestamp');
  const keys=Object.keys(fields).filter(k=>header.includes(k));
  if(stamp===-1||!keys.length)throw new Error('timestamp와 지원 계측 열 1개 이상이 필요합니다. CSV 예제를 참고하세요.');
  const quality=Object.fromEntries(keys.map(k=>[k,{missing:0,invalid:0,valid:0,index:header.indexOf(k)}]));
  const rows=[], seen=new Set(); let dupe=0,badTime=0,badLength=0;
  for(const rec of input){
   if(rec.length!==header.length){badLength++;continue;}
   const t=time(rec[stamp]);
   if(!Number.isFinite(t)){badTime++;continue;}
   if(seen.has(t)){dupe++;continue;}
   seen.add(t);
   const values={}, flags={};
   for(const k of keys){
    const stats=quality[k], val=rec[stats.index];
    const number=val&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(val)?Number(val):NaN;
    const ok=Number.isFinite(number)&&(temperature.has(k)||number>=0)&&(k!=='ess_soc_pct'||number<=100);
    if(!val)stats.missing++;
    else if(!ok)stats.invalid++;
    else stats.valid++;
    values[k]=ok?number:null;
    flags[k]=ok?'valid':val?'invalid':'missing';
   }
   rows.push({t,values,flags});
  }
  rows.sort((a,b)=>a.t-b.t);
  const intervals=new Map();
  for(let i=1;i<rows.length;i++){const dt=rows[i].t-rows[i-1].t;intervals.set(dt,(intervals.get(dt)??0)+1);}
  const step=[...intervals].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]??0;
  const gaps=step?rows.slice(1).filter((r,i)=>r.t-rows[i].t>1.5*step).length:0;
  const days = [...new Set(rows.map(r=>day(r.t)))];
  return {keys,rows,quality,total:input.length,dupe,badTime,badLength,step,gaps,days};
 }
 const dayMs=86400000;
 const dateOffset=d=>Date.parse(d+'T00:00:00Z');
 function period(data,key,from,to){
  const start=dateOffset(from), end=dateOffset(to), days=(end-start)/dayMs+1;
  if(!Number.isInteger(days)||days<1||!data.keys.includes(key))return null;
  const daily=new Map(), byHour=Array.from({length:24},()=>({values:[],dates:new Set()}));
  let valid=0, total=0, low=Infinity, high=-Infinity;
  for(const r of data.rows){
   const date=day(r.t);
   if(date<from||date>to)continue;
   const entry=daily.get(date)??{date,offset:(dateOffset(date)-start)/dayMs,n:0,total:0,min:Infinity,max:-Infinity,mean:0};
   entry.total++;total++;daily.set(date,entry);
   const v=r.values[key];
   if(!Number.isFinite(v))continue;
   entry.min=Math.min(entry.min,v);entry.max=Math.max(entry.max,v);
   entry.n++;entry.mean=entry.mean*((entry.n-1)/entry.n)+v/entry.n;
   low=Math.min(low,v);high=Math.max(high,v);valid++;
   const hour=byHour[Number(displayTime(r.t).slice(0,2))];
   hour.values.push(v);hour.dates.add(date);
  }
  const quantile=(sorted,q)=>{
   const i=(sorted.length-1)*q, lo=Math.floor(i), ratio=i-lo;
   return sorted[lo]*(1-ratio)+sorted[Math.ceil(i)]*ratio;
  };
  const hourly=byHour.map(({values,dates})=>{
   if(!values.length)return null;
   values.sort((a,b)=>a-b);
   const mean=values.reduce((acc,v,i)=>acc*(i/(i+1))+v/(i+1),0);
   return {n:values.length,days:dates.size,min:values[0],max:values.at(-1),mean,
    q1:quantile(values,.25),median:quantile(values,.5),q3:quantile(values,.75)};
  });
  return {start,end,days,daily:[...daily.values()],hourly,valid,total,low,high};
 }
 const api={fields,inspect,day,displayTime,period};
 if(typeof module!=='undefined')module.exports=api;else root.P2HMeasure=api;
})(globalThis);
