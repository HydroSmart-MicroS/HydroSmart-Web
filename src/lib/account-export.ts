import type {User} from './types';
export function accountExport(user:User){
 return {exportedAt:new Date().toISOString(),account:{id:user.id,name:user.name,email:user.email,profileType:user.profileType,image:user.image||null}};
}
