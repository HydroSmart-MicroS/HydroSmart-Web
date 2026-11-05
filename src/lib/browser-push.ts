import {api} from './api';
export const pushSupported=()=>typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
export async function browserSubscription(){
 if(!pushSupported())return null;
 const registration=await navigator.serviceWorker.getRegistration('/app/');
 return registration?.pushManager.getSubscription()||null;
}
export async function enableBrowserPush(){
 if(!pushSupported())throw new Error('Este navegador necesita HTTPS o localhost y compatibilidad con notificaciones push.');
 if(await Notification.requestPermission()!=='granted')throw new Error('El navegador no concedió permiso. Puedes cambiarlo desde sus ajustes de notificaciones.');
 const config=await api<{configured:boolean;publicKey:string}>('notifications/push/config');
 if(!config.configured)throw new Error('El servicio de avisos del navegador todavía no está configurado.');
 await disableBrowserPush();
 const registration=await navigator.serviceWorker.register('/app/sw.js',{scope:'/app/'});
 await navigator.serviceWorker.ready;
 const raw=atob(config.publicKey.replaceAll('-','+').replaceAll('_','/'));
 const key=Uint8Array.from(raw,c=>c.charCodeAt(0)).buffer;
 const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 try{await api('notifications/push/subscriptions','POST',subscription.toJSON());}
 catch(error){await subscription.unsubscribe();throw error;}
 return subscription;
}
export async function disableBrowserPush(){
 const subscription=await browserSubscription();if(!subscription)return;
 let failure:unknown;
 try{await api('notifications/push/subscriptions','DELETE',{endpoint:subscription.endpoint});}catch(error){failure=error;}
 const removed=await subscription.unsubscribe();
 const registration=await navigator.serviceWorker.getRegistration('/app/');
 for(const notice of await registration?.getNotifications()||[])notice.close();
 if(failure&&!removed)throw failure;
}
