import HydroSmart from '../../components/HydroSmart';
import {PasswordRecovery} from '../../components/PasswordRecovery';
export const dynamic = 'force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  const {path} = await params;
  if(path?.join('/')==='forgot-password'||path?.join('/')==='reset-password')return <PasswordRecovery reset={path?.[0]==='reset-password'}/>;
  return <HydroSmart view={path?.join('/') || 'dashboard'}/>;
}

