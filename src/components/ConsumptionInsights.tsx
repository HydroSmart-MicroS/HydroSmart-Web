'use client';
import Link from 'next/link';
import {useState} from 'react';
import {liters,money,type Dashboard,type Device,type Goal} from '../lib/types';
import {Icon} from './Ui';

export function ConsumptionStatus({goal,loaded,error}:{goal:Goal|null;loaded:boolean;error:string}){
 const state=error||!loaded?'unknown':!goal?'unset':goal.progress.percent>=100?'over':goal.progress.percent>=80?'near':'within';
 const labels={unknown:'Presupuesto no disponible',unset:'Sin presupuesto mensual',over:'Presupuesto alcanzado',near:'Cerca de tu presupuesto',within:'Dentro de tu presupuesto'};
 return <section className={'card consumption-status '+state} aria-label="Estado del consumo"><span className="status-symbol"><Icon name={state==='over'||state==='near'?'shield':'drop'}/></span><div><h2>{labels[state]}</h2><p>{error?'No pudimos consultar tu meta. Volveremos a intentarlo.':!loaded?'Consultando tu meta personal…':goal?money(goal.progress.cost)+' de '+money(goal.budget)+' · '+liters(goal.progress.percent)+'% utilizado.':'Define una meta para interpretar el costo mensual de tu consumo.'}</p><small>Verde: menos del 80% · Ámbar: desde el 80% · Rojo: desde el 100%. Las lecturas recientes se indican por separado.</small></div><Link className="text-link" href="/alertas">{goal?'Revisar mi meta':'Crear una meta'} <Icon name="arrow"/></Link></section>;
}

export function ComparisonPanel({data,loading}:{data:Dashboard|null;loading:boolean}){
 const [period,setPeriod]=useState<'weekly'|'monthly'>('weekly');
 const value=data?.comparisons?.[period];
 const current=period==='weekly'?'Última semana completa':'Días comparables del mes actual',previous=period==='weekly'?'Semana anterior':'Mismos días del mes anterior';
 const max=Math.max(value?.currentLiters||0,value?.previousLiters||0,1);
 return <section className="card comparison-panel"><div className="card-heading"><div><h2>Compara tu consumo</h2><p>{period==='weekly'?'Dos semanas completas, de lunes a domingo.':'El mismo número de días completos en ambos meses.'} Fechas de Lima.</p></div><div className="comparison-tabs" role="group" aria-label="Período de comparación">{(['weekly','monthly'] as const).map(key=><button type="button" key={key} aria-pressed={period===key} onClick={()=>setPeriod(key)}>{key==='weekly'?'Semanal':'Mensual'}</button>)}</div></div>
  {!value||!value.available?<p className="muted" role="status">{loading?'Consultando comparación…':value?.reason||'La comparación no está disponible temporalmente. Reintenta la consulta.'}</p>:<>
   {[{name:current,from:value.currentStart,to:value.currentEnd,liters:value.currentLiters!},{name:previous,from:value.previousStart,to:value.previousEnd,liters:value.previousLiters!}].map((row,i)=><div className="comparison-row" key={row.name}><div><strong>{row.name}</strong><small>{row.from} — {row.to}</small></div><div className="comparison-track" aria-hidden="true"><span className={i?'previous':''} style={{width:row.liters/max*100+'%'}}/></div><strong>{liters(row.liters)} L</strong></div>)}
   <p className="comparison-result">{value.changePercent===null?'El período anterior registró 0 L; no hay base para calcular un porcentaje.':value.changePercent===0?'El consumo se mantuvo igual.':liters(Math.abs(value.changePercent))+'% '+(value.changePercent>0?'más':'menos')+' consumo frente al período anterior.'}</p>
  </>}
 </section>;
}

export function RecommendationsPanel({data,devices,loading,preview=false}:{data:Dashboard|null;devices:Device[];loading:boolean;preview?:boolean}){
 const advice=data?.recommendations||[];
 return <section className="card recommendations-panel"><div className="card-heading"><div><h2>Recomendaciones para tu unidad</h2><p>Consejos según tus lecturas y períodos comparables. Se actualizan con el consumo.</p></div>{preview&&<Link className="text-link" href="/recomendaciones">Ver recomendaciones <Icon name="arrow"/></Link>}</div>
 {advice.length?<div className="recommendation-grid">{advice.map(item=><article key={item.code}><span className="recommendation-icon"><Icon name="drop"/></span><h3>{item.title}{item.deviceId&&' · '+(devices.find(d=>d.id===item.deviceId)?.name||'Medidor con más consumo')}</h3><p>{item.body}</p><Link className="text-link" href={['/historial','/dispositivos','/alertas'].includes(item.path)?item.path:'/historial'}>Revisar <Icon name="arrow"/></Link></article>)}</div>:<p className="muted" role="status">{loading?'Preparando recomendaciones…':!data?'No pudimos consultar tu consumo. Reintenta la consulta.':'Necesitamos consumo registrado en los últimos siete días completos para mostrar recomendaciones personalizadas.'}</p>}
 </section>;
}
