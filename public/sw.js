'use strict';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let notice={};try{notice=event.data?.json()||{};}catch{}
  const data=notice.data||{},leak=notice.kind==='possible_leak'&&uuid(data.alertId)&&uuid(data.unitId)&&!data.decision;
  await self.registration.showNotification(String(notice.title||'HydroSmart'),{
   body:String(notice.body||'Tienes un nuevo aviso en HydroSmart.'),tag:String(notice.id||'hydrosmart'),
   data:{unitId:uuid(data.unitId)?data.unitId:null,alertId:uuid(data.alertId)?data.alertId:null,kind:notice.kind},
   actions:leak?[{action:'confirmed',title:'Confirmar fuga'},{action:'dismissed',title:'Descartar'}]:[],
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const data=event.notification.data||{};
  if(['confirmed','dismissed'].includes(event.action)&&uuid(data.alertId)&&uuid(data.unitId)){
   try{
    const session=await fetch('/api/auth/token',{credentials:'same-origin',cache:'no-store'});
    const {token}=await session.json();if(!session.ok||typeof token!=='string')throw new Error();
    const result=await fetch('/api/v1/alerts/'+data.alertId+'/decision?unitId='+data.unitId,{method:'POST',
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({decision:event.action})});
    if(result.ok)return;
   }catch{}
  }
  const path=data.kind==='possible_leak'?'/alertas':data.kind==='meter_offline'?'/dispositivos':'/notificaciones';
  const target=self.location.origin+'/app'+path+(uuid(data.unitId)?'?unitId='+data.unitId:'');
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const current=windows.find(client=>client.url.startsWith(self.location.origin+'/app'));
  if(current){await current.navigate(target);await current.focus();}else await self.clients.openWindow(target);
 })());
});
