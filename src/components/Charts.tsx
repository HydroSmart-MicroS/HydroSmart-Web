import {useId} from 'react';
import {Icon} from './Ui';
import type { Daily,Device } from '../lib/types';
import {liters} from '../lib/types';
export function ConsumptionChart({daily}:{daily:Daily[]}) {
  const fillId=useId();
  const sums=new Map<string,number>();
  daily.forEach(d=>sums.set(d.date,(sums.get(d.date)||0)+d.liters));
  const points=[...sums].sort(([a],[b])=>a.localeCompare(b));
  if (!points.length) return <div className="chart-empty"><Icon name="drop"/><strong>Todavía no hay lecturas</strong><p>Activa tus medidores virtuales y prepara una demostración.</p></div>;
  const max=Math.max(...points.map(([,n])=>n),1)*1.15;
  const width=520,height=196,pad=40,step=(width-pad*2)/Math.max(points.length-1,1);
  const coords=points.map(([,value],i)=>[pad+i*step,height-pad-value/max*(height-pad*2)]);
  const dateTicks=new Set(Array.from({length:5},(_,index)=>Math.round(index*(points.length-1)/4)));
  const line=coords.map(([x,y],i)=>(i?'L':'M')+x+','+y).join(' ');
  const area=line+' L'+coords.at(-1)![0]+','+(height-pad)+' L'+pad+','+(height-pad)+' Z';
  return <><svg viewBox={'0 0 '+width+' '+height} className="consumption-chart" role="img" aria-label={'Consumo diario en litros. '+points.map(([d,n])=>d+': '+liters(n)+' L').join('; ')}>
    <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--blue)" stopOpacity=".18"/><stop offset="100%" stopColor="var(--blue)" stopOpacity=".01"/></linearGradient></defs>
    {[0,.5,1].map(f=><g key={f}><line x1={pad} x2={width-pad} y1={height-pad-f*(height-pad*2)} y2={height-pad-f*(height-pad*2)} stroke="var(--line)" strokeDasharray="4 5"/><text x={pad-8} y={height-pad-f*(height-pad*2)+4} textAnchor="end">{liters(Math.round(max*f))}</text></g>)}
    <path d={area} fill={`url(#${fillId})`}/><path d={line} fill="none" stroke="var(--blue)" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
    {points.map(([date,value],i)=><g key={date}><circle cx={coords[i][0]} cy={coords[i][1]} r="2" fill="var(--blue)"><title>{date+': '+liters(value)+' L'}</title></circle>{dateTicks.has(i)&&<text className={i===0||i===points.length-1?undefined:'minor-tick'} x={coords[i][0]} y={height-12} textAnchor="middle">{date.slice(8)+'/'+date.slice(5,7)}</text>}</g>)}
  </svg><div className="chart-caption"><span><i className="dot teal"/>Consumo diario · litros</span><span>Hora de Lima (UTC−5)</span></div></>;
}
export function DeviceBreakdown({daily,devices,totalLiters}:{daily:Daily[];devices:Device[];totalLiters?:number}) {
  const sums=new Map<string,number>();daily.forEach(d=>sums.set(d.deviceId,(sums.get(d.deviceId)||0)+d.liters));
  const zones=[...sums].filter(([id])=>devices.find(d=>d.id===id)?.category!=='GENERAL');
  const entries=(zones.length?zones:[...sums]).sort((a,b)=>b[1]-a[1]);
  const total=totalLiters??entries.reduce((s,[,n])=>s+n,0);
  return entries.length?<div className="device-breakdown">{entries.map(([id,n],i)=><div key={id}><div className="spread"><span>{devices.find(d=>d.id===id)?.name||'Medidor archivado'}</span><strong>{liters(n)} <small>L</small></strong></div><div className="bar-track"><span style={{width:Math.min(100,total?n/total*100:0)+'%',background:i===0?'var(--blue)':'var(--secondary-series)'}}/></div><small>{total?Math.round(n/total*100):0}% del período</small></div>)}</div>:<p className="muted empty-small">La distribución aparecerá con tus primeras lecturas.</p>;
}

