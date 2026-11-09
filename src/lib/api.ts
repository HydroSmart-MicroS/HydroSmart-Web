let token = '';
let expiresAt = 0;
let refresh: Promise<string> | null = null;
let sessionVersion = 0;
export function forgetToken() {sessionVersion++; token=''; expiresAt=0; refresh=null;}
function requireSession(version:number) {
  if(version!==sessionVersion)throw new DOMException('La sesión cambió. Vuelve a intentar la acción.','AbortError');
}
export class ApiError extends Error {
  constructor(message:string,public status:number) {super(message);}
}
async function jsonResponse(response:Response) {
  const body = response.status===204 ? null : await response.json().catch(()=>null);
  if (!response.ok) {
    const authMessages:Record<string,string>={INVALID_PASSWORD:'La contraseña actual no es correcta.',INVALID_EMAIL_OR_PASSWORD:'El correo o la contraseña no son correctos.',USER_ALREADY_EXISTS:'Ya hay una cuenta con ese correo.',USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:'Ya hay una cuenta con ese correo.'};
    const message = response.status===429?'Demasiados intentos. Espera unos segundos y vuelve a intentarlo.':authMessages[body?.code]|| (typeof body?.detail==='string' ? body.detail : typeof body?.message==='string' ? body.message :
      response.status===401 ? 'Tu sesión venció. Vuelve a iniciar sesión.' :
      response.status===403 ? 'Tu perfil no tiene permiso para esta acción.' :
      response.status===404 ? 'No encontramos ese recurso o ya no tienes acceso.' :
      response.status===409 ? (typeof body?.error==='string'&&/\s/.test(body.error)?body.error:'Ya existe ese registro o tiene datos asociados.') :
      response.status===400 || response.status===422 ? 'Revisa los campos e inténtalo otra vez.' :
      'El servicio no está disponible. Inténtalo en unos segundos.');
    throw new ApiError(message,response.status);
  }
  return body;
}
export async function authRequest(path:string,body?:unknown) {
  return jsonResponse(await fetch('/api/auth/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',
    headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'}));
}
async function jwt(version:number) {
  requireSession(version);
  if (token && Date.now()<expiresAt) return token;
  if (!refresh) {
    const pending:Promise<string>=authRequest('token').then(data=>{
      requireSession(version);
      if (!data?.token) throw new ApiError('Inicia sesión para continuar.',401);
      token=data.token;expiresAt=Date.now()+240000;return token;
    });
    const tracked:Promise<string>=pending.finally(()=>{if(refresh===tracked)refresh=null;});
    refresh=tracked;
  }
  return refresh;
}
async function authorizedRequest(path:string,method='GET',body?:unknown,retry=true) {
  const version=sessionVersion;
  try {
    for(let attempt=0;attempt<(retry?2:1);attempt++) {
      const bearer=await jwt(version);
      requireSession(version);
      const response=await fetch('/api/v1/'+path,{method,headers:{Authorization:'Bearer '+bearer,...(body===undefined?{}:{'Content-Type':'application/json'})},
        body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
      requireSession(version);
      if(response.status===401&&retry&&attempt===0){if(token===bearer){token='';expiresAt=0;}continue;}
      if(response.status===402&&typeof window!=='undefined')window.dispatchEvent(new Event('subscription-required'));
      if(!response.ok)await jsonResponse(response);
      requireSession(version);
      return {response,version};
    }
    throw new ApiError('Tu sesión venció. Vuelve a iniciar sesión.',401);
  } catch(error) {
    requireSession(version);
    if (error instanceof ApiError && error.status===401 && typeof window!=='undefined') window.dispatchEvent(new Event('session-expired'));
    throw error;
  }
}
export async function api<T=any>(path:string,method='GET',body?:unknown,retry=true):Promise<T> {
  const {response,version}=await authorizedRequest(path,method,body,retry);
  const value=await jsonResponse(response);
  requireSession(version);
  return value;
}
export const messageOf=(error:unknown)=>error instanceof Error?error.message:'No pudimos completar la acción.';


export async function apiDownload(path:string,name:string) {
  const {response,version}=await authorizedRequest(path);
  const blob=await response.blob();requireSession(version);
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
