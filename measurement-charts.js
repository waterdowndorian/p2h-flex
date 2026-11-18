(() => {
 const $=s=>document.querySelector(s);
 const W=660,L=76,R=638,T=36,B=192;
 const teal='#087481', band='#bde5ec', red='#ba382c';
 const oneDay=86400000;
 const fmt=(v,d=2)=>Math.abs(v)>=1e5||v!==0&&Math.abs(v)<.01
  ?v.toExponential(1):v.toLocaleString('ko-KR',{maximumFractionDigits:d});
 const f=v=>v.toFixed(2);
 const line=(x,y,X,Y,stroke,extra='')=>`<line x1="${f(x)}" y1="${f(y)}" x2="${f(X)}" y2="${f(Y)}" stroke="${stroke}" ${extra}/>`;
 const tick=(x,y,label,anchor='middle')=>`<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}">${label}</text>`;
 const mark=(x,y,r)=>`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${red}" stroke="white" stroke-width="1.1"/>`;
 const path=(points,stroke,extra='')=>`<polyline points="${points.join(' ')}" fill="none" stroke="${stroke}" ${extra}/>`;
 const svg=(title,desc,body)=>`<svg viewBox="0 0 ${W} 228" role="img" aria-label="${title}"><title>${title}</title><desc>${desc}</desc>${body}</svg>`;
 function axis(low,high,unit){
  if(low===high){
   const pad=Math.max(Math.abs(low)*.12,.01);
   low=Math.min(low,0);high=Math.max(high,0);
   if(high===low)high=pad;
  }
  const y=v=>B-(v/2-low/2)/(high/2-low/2)*(B-T);
  let body=tick(L,20,unit,'start');
  for(let i=0;i<=4;i++){
   const a=i/4, v=low*(1-a)+high*a, yy=B-a*(B-T);
   body+=`<line class="grid" x1="${L}" x2="${R}" y1="${yy}" y2="${yy}"/>`+tick(L-9,yy+5,fmt(v),'end');
  }
  body+=line(L,T,L,B,'#a1b5c9')+line(L,B,R,B,'#a1b5c9');
  return [y,body];
 }
 function trend(p,label,unit){
  const [y,frame]=axis(p.low,p.high,unit);
  const x=i=>L+(R-L)*(p.days===1?.5:i/(p.days-1));
  const point=(r,k)=>f(x(r.offset))+','+f(y(r[k]));
  const spans=[];let current=[];
  for(const d of p.daily){
   if(!d.n||current.length&&d.offset!==current.at(-1).offset+1){
    if(current.length)spans.push(current);
    current=[];
   }
   if(d.n)current.push(d);
  }
  if(current.length)spans.push(current);
  const tickCount=Math.min(5,p.days);
  let body=frame;
  for(let i=0;i<tickCount;i++){
   const d=tickCount===1?0:Math.round(i*(p.days-1)/(tickCount-1));
   const date=new Date(p.start+d*oneDay).toISOString().slice(0,10);
   const showYear=new Date(p.start).getUTCFullYear()!==new Date(p.end).getUTCFullYear();
   body+=tick(x(d),215,showYear?date.slice(2):date.slice(5),tickCount===1?'middle':i===0?'start':i===tickCount-1?'end':'middle');
  }
  for(const group of spans){
   if(group.length>1){
    const points=group.map(r=>point(r,'max')).concat(group.slice().reverse().map(r=>point(r,'min')));
    body+=`<polygon points="${points.join(' ')}" fill="${band}" opacity=".85"/>`;
    body+=path(group.map(r=>point(r,'mean')),red,'stroke-width="3" stroke-linejoin="round"');
   }else{
    const [r]=group;
    body+=line(x(r.offset),y(r.min),x(r.offset),y(r.max),teal,'stroke-width="3"');
    if(p.daily.length>100)body+=mark(x(r.offset),y(r.mean),2);
   }
   if(p.daily.length<=100)for(const r of group){
    body+=`<g><title>${r.date} · 평균 ${fmt(r.mean)} · 최소–최대 ${fmt(r.min)}–${fmt(r.max)} ${unit} · 유효 ${r.n}/${r.total}</title>${mark(x(r.offset),y(r.mean),4.3)}</g>`;
   }
  }
  return svg(label+' 일별 평균과 범위','일별 평균과 최솟값부터 최댓값까지의 범위를 표시합니다. 계측 공백은 연결하지 않습니다.',body);
 }
 function profile(p,label,unit){
  const [y,frame]=axis(p.low,p.high,unit);
  const x=h=>L+(R-L)*(h+.5)/24;
  const half=6.8;
  let body=frame;
  for(let h=0;h<24;h+=3)body+=tick(x(h),215,String(h).padStart(2,'0')+'시');
  const means=[];let group=[];
  p.hourly.forEach((r,h)=>{
   if(!r||r.days<2){if(group.length)means.push(group);group=[];return;}
   const xx=x(h), top=y(r.q3), bot=y(r.q1);
   body+=`<g><title>${h}시대 · ${r.days}일의 유효값 ${r.n}개 · 최소 ${fmt(r.min)} · Q1 ${fmt(r.q1)} · 중앙값 ${fmt(r.median)} · Q3 ${fmt(r.q3)} · 최대 ${fmt(r.max)} · 평균 ${fmt(r.mean)} ${unit}</title>`;
   body+=line(xx,y(r.min),xx,y(r.max),teal,'stroke-width="1.8"');
   for(const v of [r.min,r.max])body+=line(xx-4,y(v),xx+4,y(v),teal,'stroke-width="1.8"');
   body+=`<rect x="${f(xx-half)}" y="${f(top)}" width="${half*2}" height="${f(Math.max(.8,bot-top))}" fill="${band}" stroke="${teal}" stroke-width="1.8"/>`;
   body+=line(xx-half,y(r.median),xx+half,y(r.median),teal,'stroke-width="2.5"')+'</g>';
   group.push([xx,y(r.mean)]);
  });
  if(group.length)means.push(group);
  for(const segment of means){
   if(segment.length>1)body+=path(segment.map(([x,y])=>f(x)+','+f(y)),red,'stroke-width="2.2" stroke-dasharray="5 3" pointer-events="none"');
   for(const [xx,yy] of segment)body+=`<g pointer-events="none">${mark(xx,yy,3.9)}</g>`;
  }
  return svg(label+' 시간대별 상자그림','두 날짜 이상의 유효 표본이 있는 시간대에 최솟값, 25백분위, 중앙값, 75백분위, 최댓값과 평균을 표시합니다.',body);
 }
 const empty=message=>'<p class="empty-chart">'+message+'</p>';
 function render(p,label,unit){
  $('#measure-period-panels').hidden=!p;
  if(!p)return;
  $('#measure-period-chart').innerHTML=p.valid?trend(p,label,unit):empty('선택기간에 표시할 유효값이 없습니다.');
  $('#measure-profile-chart').innerHTML=p.hourly.some(r=>r&&r.days>=2)?profile(p,label,unit):empty('상자그림은 같은 시간대의 유효값이 두 날짜 이상 있어야 표시됩니다.');
 }
 window.P2HMeasurementCharts={render};
})();
