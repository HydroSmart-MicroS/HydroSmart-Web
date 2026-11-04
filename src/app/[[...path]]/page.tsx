import HydroSmart from '../../components/HydroSmart';
export const dynamic = 'force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  const {path} = await params;
  return <HydroSmart view={path?.join('/') || 'dashboard'}/>;
}

