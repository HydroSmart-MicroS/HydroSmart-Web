import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const alert='11111111-1111-4111-8111-111111111111',unit='22222222-2222-4222-8222-222222222222';
function worker(){
 const events={},shown=[],requests=[],opened=[];
 const self={addEventListener:(name,handler)=>events[name]=handler,location:{origin:'http://localhost:8080'},
  registration:{showNotification:async(title,options)=>shown.push({title,options})},
  clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(source,{self,fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({token:'private-runtime-token'})};}});
 return {events,shown,requests,opened,async fire(name,value){let pending;events[name]({...value,waitUntil:promise=>pending=promise});await pending;}};
}
test('push provides actions only for a valid leak and never trusts supplied navigation URLs',async()=>{
 const w=worker();await w.fire('push',{data:{json:()=>({title:'Posible fuga',kind:'possible_leak',data:{alertId:alert,unitId:unit,url:'https://evil.example'}})}});
 assert.equal(w.shown[0].options.actions.length,2);
 await w.fire('push',{data:{json:()=>({kind:'possible_leak',data:{alertId:'../not-valid',unitId:unit}})}});
 assert.equal(w.shown[1].options.actions.length,0);
 await w.fire('notificationclick',{notification:{data:{kind:'possible_leak',unitId:unit,url:'https://evil.example'},close(){}},action:''});
 assert.equal(w.opened[0],'http://localhost:8080/app/alertas?unitId='+unit);
});
test('one-click confirmation gets an ephemeral token and authorizes the exact unit and alert',async()=>{
 const w=worker();await w.fire('notificationclick',{action:'confirmed',notification:{data:{alertId:alert,unitId:unit},close(){}}});
 assert.equal(w.requests[0].url,'/api/auth/token');
 assert.equal(w.requests[1].url,'/api/v1/alerts/'+alert+'/decision?unitId='+unit);
 assert.equal(JSON.parse(w.requests[1].options.body).decision,'confirmed');assert.equal(w.opened.length,0);
 assert.ok(!source.includes('localStorage'));
});
