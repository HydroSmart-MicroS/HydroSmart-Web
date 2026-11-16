import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile(new URL('../src/lib/api.ts',import.meta.url),'utf8');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})+'\n// '+Math.random()).toString('base64'));
test('session JWT avoids a second token request without using browser storage',async()=>{
 const previous=globalThis.fetch,calls=[];
 globalThis.fetch=async(path,options)=>{
  calls.push(path);
  if(path==='/api/auth/get-session')return new Response(JSON.stringify({user:{id:'self'}}),{headers:{'set-auth-jwt':'SESSION_JWT'}});
  assert.equal(options.headers.Authorization,'Bearer SESSION_JWT');return Response.json({});
 };
 try{const api=await load();await api.authRequest('get-session');await api.api('billing/status');assert.deepEqual(calls,['/api/auth/get-session','/api/v1/billing/status']);}finally{globalThis.fetch=previous;}
});
test('a late session header cannot replace the next account token',async()=>{
 const previous=globalThis.fetch;let resolveSession;
 globalThis.fetch=path=>path==='/api/auth/get-session'?new Promise(resolve=>{resolveSession=resolve}):Promise.resolve(Response.json({token:'CURRENT'}));
 try{
  const api=await load(),old=api.authRequest('get-session').catch(e=>e);
  api.forgetToken();resolveSession(new Response(JSON.stringify({user:{id:'old'}}),{headers:{'set-auth-jwt':'OLD'}}));
  assert.equal((await old).name,'AbortError');
  let bearer;globalThis.fetch=async(path,options)=>path==='/api/auth/token'?Response.json({token:'CURRENT'}):(bearer=options.headers.Authorization,Response.json({}));
  await api.api('units');assert.equal(bearer,'Bearer CURRENT');
 }finally{globalThis.fetch=previous;}
});
test('an anonymous session response cannot prime a bearer token',async()=>{
 const previous=globalThis.fetch,calls=[];
 globalThis.fetch=async(path,options)=>{
  calls.push(path);
  if(path==='/api/auth/get-session')return new Response('null',{headers:{'set-auth-jwt':'UNTRUSTED'}});
  if(path==='/api/auth/token')return Response.json({token:'CURRENT'});
  assert.equal(options.headers.Authorization,'Bearer CURRENT');return Response.json({});
 };
 try{const api=await load();await api.authRequest('get-session');await api.api('units');assert.ok(calls.includes('/api/auth/token'));}finally{globalThis.fetch=previous;}
});
