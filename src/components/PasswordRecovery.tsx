'use client';
import Link from 'next/link';
import {useEffect,useState,type FormEvent} from 'react';
import {ApiError,authRequest,forgetToken,messageOf} from '../lib/api';
import {passwordError,passwordHint,passwordPattern} from '../lib/validation';
import {Brand,Field,Icon} from './Ui';
export function PasswordRecovery({reset}:{reset:boolean}){
 const [token,setToken]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{
  const query=new URLSearchParams(location.search);setToken(query.get('token')||'');
  setReady(true);
  if(reset&&(!query.get('token')||query.get('error')))setError('Este enlace no es válido o ya venció. Solicita uno nuevo.');
 },[reset]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setError('');setNotice('');
  const form=new FormData(event.currentTarget);
  if(reset){const invalid=passwordError(String(form.get('password')),String(form.get('confirmPassword')));if(invalid){setError(invalid);return;}}
  setBusy(true);
  try{
   if(reset){await authRequest('reset-password',{token,newPassword:form.get('password'),confirmPassword:form.get('confirmPassword')});forgetToken();setDone(true);history.replaceState(null,'','/app/reset-password');setToken('');setNotice('Tu contraseña fue actualizada y cerramos tus sesiones anteriores. Inicia sesión con la nueva contraseña.');}
   else{await authRequest('request-password-reset',{email:String(form.get('email')).trim(),redirectTo:location.origin+'/app/reset-password'});setNotice('Si existe una cuenta con ese correo, recibirás un enlace para elegir una nueva contraseña. Revisa también la carpeta de spam. El enlace dura 30 minutos.');}
  }catch(failure){setError(reset&&failure instanceof ApiError&&[400,401].includes(failure.status)?'El enlace venció o ya fue utilizado. Solicita uno nuevo.':messageOf(failure));}
  finally{setBusy(false);}
 }
 return <main className="auth-layout"><section className="auth-story"><a href="/" className="brand-link"><Brand/></a><div className="auth-story-copy"><span className="eyebrow">TU CUENTA, SEGURA</span><h1>Recupera <br/>tu espacio.</h1><p>Elige una contraseña nueva con un enlace seguro enviado a tu correo.</p><Icon name="shield"/></div><small>HydroSmart · Proyecto académico</small></section>
 <section className="auth-form-area"><Link href="/login" className="back-link">← Volver a iniciar sesión</Link><div className="auth-form-wrap"><span className="eyebrow">SEGURIDAD DE TU CUENTA</span><h2>{reset?'Elige una nueva contraseña':'¿Olvidaste tu contraseña?'}</h2><p className="muted">{reset?'El enlace solo puede usarse una vez.':'Ingresa el correo con el que creaste tu cuenta.'}</p>
 {error&&<div className="message error" role="alert">{error}</div>}{notice&&<div className="message success" role="status">{notice}</div>}
 {!done&&<form className="stacked-form" method="post" onSubmit={submit}>{reset?<><Field label="Nueva contraseña" hint={passwordHint}><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} pattern={passwordPattern} required/></Field><Field label="Repetir nueva contraseña"><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></Field></>:<Field label="Correo electrónico"><input name="email" type="email" autoComplete="email" maxLength={254} required/></Field>}
 <button className="button primary full" disabled={!ready||busy||(reset&&!token)}>{busy?'Un momento…':reset?'Guardar nueva contraseña':'Enviar enlace de recuperación'}</button></form>}
 {reset&&<p className="auth-switch"><Link href="/forgot-password">Solicitar otro enlace</Link></p>}{done&&<Link href="/login" className="button primary">Iniciar sesión</Link>}</div></section></main>;
}
