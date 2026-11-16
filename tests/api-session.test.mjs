import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {randomUUID} from 'node:crypto';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('account export includes public profile fields and excludes credentials',async()=>{
 const {accountExport}=await load('../src/lib/account-export.ts');
 const result=accountExport({id:'self',name:'Cuenta',email:'self@example.test',profileType:'inquilino',image:null,password:'secret',token:'bearer',session:{cookie:'private'}});
 assert.deepEqual(Object.keys(result.account),['id','name','email','profileType','image']);
 assert.equal(result.account.id,'self');
 assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('bearer'));
});
async function load(path){const source=await fs.readFile(new URL(path,import.meta.url),'utf8');return import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})+'\n// '+randomUUID()).toString('base64'));}
async function usingAPI(fetch,work){
 const previous={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document};
 const events=[];globalThis.fetch=fetch;globalThis.window={dispatchEvent:event=>events.push(event.type)};
 try{return await work(await load('../src/lib/api.ts'),events);}finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}

test('late token from a previous account cannot be cached or sent after switching accounts',async()=>{
 const tokens=[],requests=[];
 await usingAPI((url,options={})=>url==='/api/auth/token'?new Promise(resolve=>tokens.push(resolve)):(requests.push(options.headers.Authorization),Promise.resolve(json([]))),async(api,events)=>{
  const old=api.api('units').catch(error=>error);assert.equal(tokens.length,1);
  api.forgetToken();const current=api.api('properties');assert.equal(tokens.length,2);
  tokens[1](json({token:'ACCOUNT_B'}));await current;
  tokens[0](json({token:'ACCOUNT_A'}));assert.equal((await old).name,'AbortError');
  await api.api('units');assert.deepEqual(requests,['Bearer ACCOUNT_B','Bearer ACCOUNT_B']);assert.deepEqual(events,[]);
 });
});
test('old refresh completion cannot clear a newer pending refresh',async()=>{
 const tokens=[];
 await usingAPI(url=>url==='/api/auth/token'?new Promise(resolve=>tokens.push(resolve)):Promise.resolve(json([])),async api=>{
  const old=api.api('units').catch(error=>error);api.forgetToken();
  const current=api.api('properties');tokens[0](json({token:'ACCOUNT_A'}));await old;
  const parallel=api.api('devices');assert.equal(tokens.length,2);
  tokens[1](json({token:'ACCOUNT_B'}));await Promise.all([current,parallel]);
 });
});
test('an old unauthorized response cannot expire the newer session',async()=>{
 let oldResponse;const requests=[];
 await usingAPI((url,options={})=>{
  if(url==='/api/auth/token')return Promise.resolve(json({token:requests.length?'ACCOUNT_B':'ACCOUNT_A'}));
  requests.push(options.headers.Authorization);return requests.length===1?new Promise(resolve=>{oldResponse=resolve;}):Promise.resolve(json([]));
 },async(api,events)=>{
  const old=api.api('units').catch(error=>error);while(!oldResponse)await new Promise(resolve=>setImmediate(resolve));
  api.forgetToken();await api.api('properties');oldResponse(json({},401));assert.equal((await old).name,'AbortError');
  await api.api('units');assert.deepEqual(events,[]);assert.equal(requests.at(-1),'Bearer ACCOUNT_B');
 });
});
test('a successful response from an old session is discarded too',async()=>{
 let response;
 await usingAPI(url=>url==='/api/auth/token'?Promise.resolve(json({token:'ACCOUNT_A'})):new Promise(resolve=>{response=resolve;}),async api=>{
  const old=api.api('units').catch(error=>error);while(!response)await new Promise(resolve=>setImmediate(resolve));
  api.forgetToken();response(json([{name:'Private account A data'}]));assert.equal((await old).name,'AbortError');
 });
});
test('CSV downloads refresh a rejected token and retry once',async()=>{
 let tokenCount=0,downloads=0,clicks=0;
 await usingAPI(url=>url==='/api/auth/token'?Promise.resolve(json({token:'TOKEN_'+(++tokenCount)})):Promise.resolve(++downloads===1?json({},401):new Response('Fecha,Litros\n2026-10-01,5')),async api=>{
  globalThis.document={createElement:()=>({click(){clicks++;}})};
  await api.apiDownload('reports/id/download','report.csv');assert.equal(tokenCount,2);assert.equal(downloads,2);assert.equal(clicks,1);
 });
});
test('downloads notify subscription expiry and do not produce a file',async()=>{
 await usingAPI(url=>Promise.resolve(url==='/api/auth/token'?json({token:'TOKEN'}):json({detail:'Renueva tu plan'},402)),async(api,events)=>{
  await assert.rejects(api.apiDownload('reports/id/download','report.csv'),error=>error.status===402);
  assert.deepEqual(events,['subscription-required']);
 });
});
test('a microservice 401 does not sign out a valid Identity session',async()=>{
 let calls=0;
 await usingAPI(url=>Promise.resolve(url==='/api/auth/token'?json({token:'TOKEN_'+(++calls)}):json({},401)),async(api,events)=>{
  await assert.rejects(api.api('units'),error=>error.status===401);assert.equal(calls,2);assert.deepEqual(events,[]);
 });
});
test('Identity rejecting the current browser session requests a new login',async()=>{
 await usingAPI(()=>Promise.resolve(json({},401)),async(api,events)=>{
  await assert.rejects(api.api('units'),error=>error.status===401);assert.deepEqual(events,['session-expired']);
 });
});
test('a delayed Identity rejection cannot sign out a newer account',async()=>{
 let rejectOld;
 await usingAPI(()=>new Promise(resolve=>{rejectOld=resolve;}),async(api,events)=>{
  const old=api.api('units').catch(error=>error);api.forgetToken();rejectOld(json({},401));
  assert.equal((await old).name,'AbortError');assert.deepEqual(events,[]);
 });
});
test('invoice months are readable and do not shift at a timezone boundary',async()=>{
 const{monthLabel}=await load('../src/lib/types.ts');
 assert.match(monthLabel('2026-09-01'),/^(septiembre|setiembre) de 2026$/);assert.equal(monthLabel('2026-01'),'enero de 2026');assert.equal(monthLabel(null),'Mes sin fecha');
});


test('domain conflict messages explain the meter rule without exposing symbolic codes',async()=>{
 const domainMessage='Primero elige el medidor GENERAL de esta unidad desde Medidores.';
 let conflicts=0;
 await usingAPI(url=>Promise.resolve(url==='/api/auth/token'?json({token:'TOKEN'}):
   json({error:conflicts++===0?domainMessage:'duplicate_or_resource_in_use'},409)),async api=>{
  await assert.rejects(api.api('devices','POST',{}),error=>error.status===409&&error.message===domainMessage);
  await assert.rejects(api.api('devices','POST',{}),error=>error.status===409&&error.message==='Ya existe ese registro o tiene datos asociados.');
 });
});
