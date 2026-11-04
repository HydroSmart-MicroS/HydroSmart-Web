'use client';
import {useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {api,forgetToken,messageOf} from '../lib/api';
import {Field,Modal} from './Ui';
export function DeleteAccount(){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[allowed,setAllowed]=useState(false),[error,setError]=useState('');
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');const lock=useRef(false);
 async function inspect(){if(lock.current)return;lock.current=true;setOpen(true);setBusy(true);setAllowed(false);setError('');try{await api('iam/deletion');setAllowed(true);}catch(e){setError(messageOf(e));}finally{lock.current=false;setBusy(false);}}
 async function remove(e:FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const result=await api<{ticket:string}>('iam/deletion','POST',{password,confirmation},false);setPassword('');forgetToken();window.location.assign('/app/login?accountDeleted='+encodeURIComponent(result.ticket));}catch(e){setError(messageOf(e));lock.current=false;setBusy(false);}}
 return <><button className="button secondary" onClick={()=>void inspect()}>Eliminar mi cuenta</button>{open&&<Modal title="Eliminar mi cuenta" busy={busy} error={error} onClose={()=>{setOpen(false);setPassword('');setConfirmation('');}}>
 <p>Esta acción elimina tu perfil, sesiones, metas, avisos y reportes guardados. Si eres propietario, también elimina tus unidades, medidores y sus lecturas.</p>
 <p>Perderás el acceso y el tiempo restante de tu plan. No se genera un reembolso automático. Conservaremos un registro de los pagos sin tu identidad durante 365 días y luego lo borraremos.</p>
 <p className="muted small-text">Los datos de otras cuentas, las descargas y los registros que mantengan Stripe o Brevo tienen un tratamiento separado. Consulta la política de privacidad.</p>
 {!allowed?<div className="button-row"><Link className="button secondary" href="/unidades">Revisar unidades</Link><Link className="button secondary" href="/pagos">Revisar pagos</Link><button className="button secondary" disabled={busy} onClick={()=>void inspect()}>Volver a comprobar</button></div>:<form className="stacked-form" onSubmit={remove}>
 <Field label="Contraseña actual"><input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></Field>
 <Field label="Escribe ELIMINAR para confirmar" hint="No podrás deshacer esta solicitud."><input required pattern="ELIMINAR" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/></Field>
 <div className="button-row"><button className="button primary" disabled={busy||confirmation!=='ELIMINAR'||!password}>{busy?'Solicitando eliminación…':'Eliminar definitivamente'}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>{setOpen(false);setPassword('');}}>Conservar mi cuenta</button></div>
 </form>}</Modal>}</>;
}
