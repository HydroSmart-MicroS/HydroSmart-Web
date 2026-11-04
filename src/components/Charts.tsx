import type { Daily,Device } from '../lib/types';
import {liters} from '../lib/types';
export function ConsumptionChart({daily}:{daily:Daily[]}) {
  const sums=new Map<string,number>();
  daily.forEach(d=>sums.set(d.date,(sums.get(d.date)||0)+d.liters));
  const points=[...sums].sort(([a],[b])=>a.localeCompare(b));
  if (!points.length) return <div className="chart-empty"><span className="empty-drop">◌</span><strong>Todavía no hay lecturas</strong><p>Activa tus medidores virtuales y prepara una demostración.</p></div>;
  const max=Math.max(...points.map(([,n])=>n),1)*1.15;
  const width=760,height=230,pad=40,step=(width-pad*2)/Math.max(points.length-1,1);
  const coords=points.map(([,value],i)=>[pad+i*step,height-pad-value/max*(height-pad*2)]);
  const line=coords.map(([x,y],i)=>(i?'L':'M')+x+','+y).join(' ');
  const area=line+' L'+coords.at(-1)![0]+','+(height-pad)+' L'+pad+','+(height-pad)+' Z';
  return <><svg viewBox={'0 0 '+width+' '+height} className="consumption-chart" role="img" aria-label={'Consumo diario en litros. '+points.map(([d,n])=>d+': '+liters(n)+' L').join('; ')}>
    <defs><linearGradient id="water-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#18a898" stopOpacity=".23"/><stop offset="100%" stopColor="#18a898" stopOpacity=".01"/></linearGradient></defs>
    {[0,.5,1].map(f=><g key={f}><line x1={pad} x2={width-pad} y1={height-pad-f*(height-pad*2)} y2={height-pad-f*(height-pad*2)} stroke="#e6eceb" strokeDasharray="4 5"/><text x={pad-8} y={height-pad-f*(height-pad*2)+4} textAnchor="end">{Math.round(max*f)}</text></g>)}
    <path d={area} fill="url(#water-fill)"/><path d={line} fill="none" stroke="#0b9284" strokeWidth="3" strokeLinejoin="round"/>
    {points.map(([date,value],i)=><g key={date}><circle cx={coords[i][0]} cy={coords[i][1]} r="3" fill="#0b9284"><title>{date+': '+liters(value)+' L'}</title></circle>{(i===0||i===points.length-1||i%7===0)&&<text x={coords[i][0]} y={height-12} textAnchor="middle">{date.slice(8)+'/'+date.slice(5,7)}</text>}</g>)}
  </svg><div className="chart-caption"><span><i className="dot teal"/>Consumo diario · litros</span><span>Hora de Lima (UTC−5)</span></div></>;
}
export function DeviceBreakdown({daily,devices}:{daily:Daily[];devices:Device[]}) {
  const sums=new Map<string,number>();daily.forEach(d=>sums.set(d.deviceId,(sums.get(d.deviceId)||0)+d.liters));
  const entries=[...sums].sort((a,b)=>b[1]-a[1]);const total=entries.reduce((s,[,n])=>s+n,0);
  return entries.length?<div className="device-breakdown">{entries.map(([id,n],i)=><div key={id}><div className="spread"><span>{devices.find(d=>d.id===id)?.name||'Medidor archivado'}</span><strong>{liters(n)} <small>L</small></strong></div><div className="bar-track"><span style={{width:(total?n/total*100:0)+'%',background:['#0c998b','#8ac5bc','#385c6b','#b8d8cf'][i%4]}}/></div><small>{total?Math.round(n/total*100):0}% del período</small></div>)}</div>:<p className="muted empty-small">La distribución aparecerá con tus primeras lecturas.</p>;
}

