'use client';
import {useState} from 'react';
import {api,messageOf} from '../lib/api';
export function LeakActions({alertId,unitId,decision,onChanged}:{alertId:string;unitId:string;decision?:string;onChanged?:()=>Promise<void>}){
 const [result,setResult]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const state=result||decision;
 async function choose(value:'confirmed'|'dismissed'){if(busy)return;setBusy(true);setError('');try{await api('alerts/'+alertId+'/decision?unitId='+encodeURIComponent(unitId),'POST',{decision:value});setResult(value);await onChanged?.();}catch(failure){setError(messageOf(failure));}finally{setBusy(false);}}
 return <div className="leak-actions">{state&&state!=='open'?<p role="status">{state==='confirmed'?'Fuga confirmada':state==='dismissed'?'Alerta descartada':'Alerta resuelta'}</p>:<div className="button-row"><button className="button secondary" disabled={busy} onClick={()=>void choose('confirmed')}>Confirmar fuga</button><button className="button secondary" disabled={busy} onClick={()=>void choose('dismissed')}>Descartar alerta</button></div>}{error&&<p className="small-text" role="alert">{error}</p>}</div>;
}
