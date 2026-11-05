'use client';
import {useEffect,useState} from 'react';
import {browserSubscription,enableBrowserPush,disableBrowserPush,pushSupported} from '../lib/browser-push';
import {messageOf} from '../lib/api';
export function BrowserPushControls({counts}:{counts?:{pending:number;failed:number;accepted:number}}){
 const [supported,setSupported]=useState<boolean|null>(null),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setSupported(pushSupported());void browserSubscription().then(value=>setEnabled(!!value)).catch(()=>{});},[]);
 async function toggle(){if(busy)return;setBusy(true);setError('');try{if(enabled){await disableBrowserPush();setEnabled(false);}else{await enableBrowserPush();setEnabled(true);}}catch(failure){setError(messageOf(failure));}finally{setBusy(false);}}
 return <section className="card"><h2>Avisos en este navegador</h2><p className="muted">Recibe alertas en las notificaciones de tu dispositivo. Necesitamos tu permiso y que el navegador permita recibirlas.</p>
 {supported===null?<p role="status">Comprobando compatibilidad…</p>:!supported?<p>Usa un navegador compatible en localhost o en una conexión HTTPS.</p>:<><p role="status">{enabled?'Avisos activados en este navegador.':'Los avisos de este navegador están desactivados.'}</p><button className="button secondary" disabled={busy} onClick={()=>void toggle()}>{busy?'Un momento…':enabled?'Desactivar avisos de este navegador':'Activar avisos de este navegador'}</button></>}
 {counts&&<p className="small-text">Pendientes: {counts.pending} · Aceptados: {counts.accepted} · Fallidos: {counts.failed}. La aceptación no confirma que el aviso se haya mostrado en tu dispositivo.</p>}
 {error&&<p className="message error" role="alert">{error}</p>}<p className="muted small-text">Al cerrar sesión se desactivan aquí. Puedes mantener los avisos de la app y el correo; si falla push, el correo se usa solo si lo tienes habilitado.</p></section>;
}
