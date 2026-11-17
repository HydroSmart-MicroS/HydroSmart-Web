'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {api,authRequest,forgetToken,messageOf} from '../lib/api';
import type {User,Unit,Property,Device,Dashboard,Simulation,Goal} from '../lib/types';
import {monthLabel,liters,money,daysAgo,localDate,timestamp} from '../lib/types';
import {ConsumptionChart,DeviceBreakdown} from './Charts';
import {Icon,Brand,Field,PasswordInput} from './Ui';
import {RegistrationChallenge} from './RegistrationChallenge';
import {UnitManagement,MeterManagement} from './ManagementPages';
import {TariffPage} from './TariffPage';
import {AccountSecurity,Avatar} from './AccountSecurity';
import {ConsumptionStatus,ComparisonPanel,RecommendationsPanel} from './ConsumptionInsights';
import {SettingsPage} from './SettingsPage';
import {passwordError,passwordHint,passwordPattern} from '../lib/validation';
import {disableBrowserPush} from '../lib/browser-push';
import {PaymentCenter,MonitoringPage,NotificationsPage,ReportJobs,useInbox,NotificationBell,type Membership} from './Features';


const navigation=[['dashboard','Dashboard','grid'],['historial','Historial','chart'],['recomendaciones','Recomendaciones','drop'],['unidades','Unidades','home'],['dispositivos','Medidores','meter'],['tarifas','Tarifas','receipt'],['alertas','Alertas y metas','shield'],['notificaciones','Notificaciones','bell'],['pagos','Plan y pagos','receipt'],['perfil','Mi perfil','user']];
function Empty({title,children}:{title:string;children:ReactNode}) {return <div className="empty-state"><span className="empty-symbol"><Icon name="drop"/></span><h2>{title}</h2><div>{children}</div></div>;}
const emptySimulation:Simulation={running:false,seeding:false,completed:0,total:0,error:''};

export default function HydroSmart({view}:{view:string}) {
  const router=useRouter();
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  const [membership,setMembership]=useState<Membership|null>(null);
  const [initialAccessLoading,setInitialAccessLoading]=useState(true);
  const [units,setUnits]=useState<Unit[]>([]);
  const [properties,setProperties]=useState<Property[]>([]);
  const [unitId,setUnitId]=useState('');
  const [devices,setDevices]=useState<Device[]>([]);
  const [devicesLoaded,setDevicesLoaded]=useState(false);
  const [data,setData]=useState<Dashboard|null>(null);
  const [budgetGoal,setBudgetGoal]=useState<Goal|null>(null),[goalLoaded,setGoalLoaded]=useState(false),[goalError,setGoalError]=useState('');
  const [dataLoading,setDataLoading]=useState(false);
  const [readingFailed,setReadingFailed]=useState(false);
  const [simulation,setSimulation]=useState<Simulation>(emptySimulation);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [pollError,setPollError]=useState('');
  const [menu,setMenu]=useState(false);
  const [from,setFrom]=useState(daysAgo(6));
  const [to,setTo]=useState(localDate());
  const [period,setPeriod]=useState({from:daysAgo(6),to:localDate()});
  const actionLock=useRef(false);
  const [refresh,setRefresh]=useState(0);
  const [copied,setCopied]=useState(false);
  const authPage=view==='login'||view==='register';
  const manager=user?.profileType==='propietario';
  const active=membership?.active===true;
  const effectiveView=membership&&!active&&!['perfil','privacidad','configuracion'].includes(view)?'pagos':view;
  const inbox=useInbox(!!user&&active);
  const selected=units.find(u=>u.id===unitId);
  const readingStatus = dataLoading ? 'Consultando lecturas…' : readingFailed ? 'Lecturas no disponibles' : data?.available ? 'Lecturas actualizadas' : 'Sin lectura reciente';
  const title=navigation.find(([key])=>key===effectiveView)?.[1]||(view==='privacidad'?'Privacidad':view==='configuracion'?'Configuración':'Página no encontrada');
  const chooseUnit=useCallback((id:string)=>{setUnitId(id);sessionStorage.setItem('hydrosmart-unit',id);setData(null);setDevices([]);setDevicesLoaded(false);setSimulation(emptySimulation);setBudgetGoal(null);setGoalLoaded(false);setGoalError('');setError('');setNotice('');},[]);
  const loadUnits=useCallback(async(currentUser:User)=>{
    const [nextUnits,nextProperties]=await Promise.all([api<Unit[]>('units'),currentUser.profileType==='inquilino'?Promise.resolve([]):api<Property[]>('properties')]);
    setUnits(nextUnits);setProperties(nextProperties);
    const requested=new URLSearchParams(location.search).get('unitId');
    setUnitId(old=>nextUnits.find(u=>u.id===requested)?.id||(nextUnits.some(u=>u.id===old)?old:nextUnits.find(u=>u.id===sessionStorage.getItem('hydrosmart-unit'))?.id||nextUnits[0]?.id||''));
    if(requested){const url=new URL(location.href);url.searchParams.delete('unitId');history.replaceState(history.state,'',url);}
  },[]);
  const loadAccess=useCallback(async(currentUser:User)=>{
    const value=await api<Membership>('billing/status');if(typeof value?.active!=='boolean')throw new Error('No pudimos cargar tus planes. Reintenta la consulta.');setMembership(value);
    try{if(value.active)await loadUnits(currentUser);else{setUnits([]);setProperties([]);setUnitId('');}}
    finally{setInitialAccessLoading(false);}
  },[loadUnits]);
  useEffect(()=>{
    const required=()=>{setMembership(old=>old?{...old,active:false}:old);router.replace('/pagos');};
    window.addEventListener('subscription-required',required);
    return ()=>window.removeEventListener('subscription-required',required);
  },[router]);
  useEffect(()=>{
    let live=true;
    async function session() {
      try {
        const result=await authRequest('get-session');
        if (!live) return;
        if (!result?.user) {if(!authPage) router.replace('/login');return;}
        setUser(result.user);if(authPage){router.replace('/');return;}
        setLoading(false);
        await loadAccess(result.user);
      } catch(e) {if(live) setError(messageOf(e));}
      finally {if(live){setLoading(false);}}
    }
    void session();
    const expired=()=>{forgetToken();router.replace('/login');setUser(null);};
    window.addEventListener('session-expired',expired);
    return ()=>{live=false;window.removeEventListener('session-expired',expired);};
  },[authPage,loadAccess,router]);
  useEffect(()=>{setMenu(false);setNotice('');setError('');setPollError('');},[view]);
  useEffect(()=>{
    if (!active||!user||!unitId||authPage||!['dashboard','historial','dispositivos','recomendaciones'].includes(view)) return;
    let live=true,running=false;
    setDataLoading(true);setReadingFailed(false);setData(null);setDevices([]);setDevicesLoaded(false);setSimulation(emptySimulation);setBudgetGoal(null);setGoalLoaded(false);setGoalError('');
    async function poll() {
      if(running||document.hidden) return;
      running=true;
      try {
        const start=view==='historial'?period.from:daysAgo(31);
        const end=view==='historial'?new Date(new Date(period.to+'T00:00:00-05:00').getTime()+86400000).toISOString():new Date().toISOString();
        const query='unitId='+unitId+'&from='+encodeURIComponent(start+'T00:00:00-05:00')+'&to='+encodeURIComponent(end);
        const results=await Promise.allSettled([api<Dashboard>('analytics/dashboard?'+query),api<Device[]>('devices?unitId='+unitId),
          manager?api<Simulation>('simulation/'+unitId):Promise.resolve(emptySimulation),view==='dashboard'?api<Goal|null>('goals?unitId='+unitId):Promise.resolve(null)]);
        if(live){const [summary,meters,state,goalResult]=results;setReadingFailed(summary.status==='rejected');if(summary.status==='fulfilled')setData(summary.value as Dashboard);if(meters.status==='fulfilled'){setDevices(meters.value as Device[]);setDevicesLoaded(true);}else setDevicesLoaded(false);if(state.status==='fulfilled')setSimulation(state.value as Simulation);if(goalResult.status==='fulfilled'){setBudgetGoal(goalResult.value as Goal|null);setGoalLoaded(true);setGoalError('');}else{setBudgetGoal(null);setGoalLoaded(false);setGoalError(messageOf(goalResult.reason));}const failed=results.slice(0,3).find(r=>r.status==='rejected');setPollError(failed?.status==='rejected'?messageOf(failed.reason):'');}
      } catch(e) {if(live){setReadingFailed(true);setPollError(messageOf(e));}}
      finally {running=false;if(live)setDataLoading(false);}
    }
    void poll();const timer=setInterval(()=>void poll(),10000);
    return ()=>{live=false;clearInterval(timer);};
  },[user,unitId,view,authPage,period,manager,refresh,active]);
  async function action(work:()=>Promise<void>) {
    if(actionLock.current)return;
    actionLock.current=true;setBusy(true);setError('');setNotice('');
    try {await work();} catch(e){setError(messageOf(e));} finally {setRefresh(n=>n+1);actionLock.current=false;setBusy(false);}
  }
  function submit(e:FormEvent<HTMLFormElement>,work:(form:FormData)=>Promise<void>) {
    e.preventDefault();const form=new FormData(e.currentTarget);void action(()=>work(form));
  }
  async function exampleDevices(id:string) {
    const existing=await api<Device[]>('devices?unitId='+id);
    const status=await api<Membership>('billing/status');
    if(!status.devices)throw new Error('No pudimos consultar la capacidad de tu plan. Reintenta.');
    const available=existing.some(d=>d.state!=='disabled')?0:Math.min(1,Math.max(0,status.deviceLimit-status.devices.count));
    const examples=['Ducha principal','Lavadero de cocina','Lavadora','Jardín'];
    for(const [index,name] of examples.slice(0,available).entries()) {
      const device=await api<Device>('devices','POST',{unitId:id,serialNumber:'SIM-'+crypto.randomUUID(),name,category:['GENERAL','COCINA','BAÑO','RIEGO'][index]});
      await api('devices/'+device.id,'PUT',{name:device.name,category:device.category,state:'active'});
    }
    for(const device of existing.filter(d=>d.state==='registered'))await api('devices/'+device.id,'PUT',{name:device.name,category:device.category,state:'active'});

  }
  async function prepareDemo() {
    let id=unitId;
    if(!id) {
      let property=properties.find(p=>p.name==='Hogar de demostración');
      if(!property) property=await api<Property>('properties','POST',{name:'Hogar de demostración',address:'Lima · entorno de demostración'});
      const unit=await api<Unit>('units','POST',{propertyId:property.id,name:'Departamento 101'});
      id=unit.id;await loadUnits(user!);chooseUnit(id);
    }
    await exampleDevices(id);
    const ready=await api<Device[]>('devices?unitId='+id);
    if(!ready.some(d=>d.state==='active'))throw new Error('Esta unidad necesita un medidor activo. Puedes reactivar uno o revisar la capacidad de tu plan en Medidores.');
    await api('simulation/'+id,'POST',{action:'seed'});
    await api('simulation/'+id,'POST',{action:'start'});
    await loadAccess(user!);
    setNotice('Tu demostración está en marcha. Aquí aparecerán el historial y las lecturas nuevas.');
  }
  async function simulate(actionName:string) {
    const state=await api<Simulation>('simulation/'+unitId,'POST',{action:actionName});
    setSimulation(state);setNotice(actionName==='pause'?'Generación en vivo pausada. El historial permanece guardado.':actionName==='seed'?'Generación de historial iniciada: mes anterior completo y mes actual hasta ayer.':'Generación en vivo iniciada.');
  }
  if(loading) return <div className="loading-screen"><Brand/><div className="loading-bar"/><p>Cargando tu espacio…</p></div>;
  if(authPage) return <AuthScreen key={view} register={view==='register'} error={error} onSuccess={async(next)=>{forgetToken();setMembership(null);setUnits([]);setProperties([]);setUnitId('');setData(null);setDevices([]);setBudgetGoal(null);setSimulation(emptySimulation);setInitialAccessLoading(true);setUser(next);router.replace('/');}}/>;
  if(!user) return <div className="loading-screen"><Brand/><p>{error||'Abriendo el inicio de sesión…'}</p><Link className="button primary" href="/login">Iniciar sesión</Link></div>;
  return <div className="app-shell">
    <a href="#contenido" className="skip-link">Ir al contenido</a>
    {menu&&<button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={()=>setMenu(false)}/>}
    <aside className={'sidebar '+(menu?'open':'')}>
      <Link href="/" aria-label="HydroSmart, dashboard" className="brand-link"><Brand/></Link>
      <div className="workspace-label">Mi espacio</div>
      <nav aria-label="Navegación principal">{navigation.map(([key,label,icon])=><Link key={key} href={key==='dashboard'?'/':'/'+key} className={'nav-link '+(effectiveView===key?'active':'')} aria-current={effectiveView===key?'page':undefined}><Icon name={icon}/>{label}{effectiveView===key&&<span className="nav-indicator"/>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="simulation-note"><span className="pulse-dot"/><strong>Entorno de demostración</strong><p>Medidores virtuales.<br/>El consumo se genera localmente.</p></div>
        <Link href="/configuracion" className={'nav-link '+(['configuracion','privacidad'].includes(view)?'active':'')}><Icon name="shield"/>Configuración</Link>
        <button className="nav-link logout" disabled={busy} onClick={()=>void action(async()=>{await disableBrowserPush().catch(()=>{});await authRequest('sign-out',{});forgetToken();setUser(null);router.push('/login');})}><Icon name="logout"/>Cerrar sesión</button>
        <div className="sidebar-user"><Avatar user={user}/><span><strong>{user.name}</strong><small>{user.profileType==='inquilino'?'Inquilino':'Propietario'}</small></span></div>
      </div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label={menu?'Cerrar menú':'Abrir menú'} aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name="menu"/></button><div className="breadcrumb">Mi espacio <span>/</span> <strong>{title}</strong></div><div className="topbar-right"><NotificationBell inbox={inbox}/><Link href="/perfil" aria-label="Ver mi perfil"><Avatar user={user} className="small"/></Link></div></header>
      <main id="contenido" tabIndex={-1}>
        <div className={"page-heading compact-heading"+(effectiveView==="dashboard"?" dashboard-heading":"")}><h1>{title}</h1>
          {units.length>0&&!['perfil','privacidad','pagos','notificaciones','unidades','configuracion'].includes(effectiveView)&&<label className="unit-select"><Icon name="home"/><span><small>Unidad actual</small><select aria-label="Unidad actual" disabled={busy} value={unitId} onChange={e=>chooseUnit(e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.name}{properties.filter(p=>units.some(x=>x.propertyId===p.id)).length>1?' · '+(properties.find(p=>p.id===u.propertyId)?.name||''):''}</option>)}</select></span></label>}
        </div>
        <div className="messages" aria-live="polite">{(error||pollError)&&<div className="message error" role="alert"><span>{error||pollError}</span><button onClick={()=>{setError('');setPollError('');void action(()=>loadAccess(user));}}>Reintentar</button></div>}{notice&&<div className="message success">{notice}</div>}</div>
        {initialAccessLoading&&!['perfil','privacidad','configuracion'].includes(view)?<section className="card initial-access" role="status" aria-busy={!error}><h2>{error?(view==='pagos'?'No pudimos cargar tus planes.':'No pudimos cargar tu espacio.'):'Preparando tu espacio…'}</h2><p className="muted">Estamos preparando tus datos. Puedes seguir usando el menú.</p>{error&&<button className="button secondary" disabled={busy} onClick={()=>void action(()=>loadAccess(user))}>{view==='pagos'?'Reintentar planes':'Reintentar carga'}</button>}</section>:<>
        {simulation.seeding&&<div className="seed-progress" role="status"><span>Preparando tu historial de demostración <strong>{simulation.completed} / {simulation.total}</strong></span><progress value={simulation.completed} max={simulation.total||1}/></div>}
        {simulation.error&&<div className="message error" role="alert">{simulation.error}</div>}
        {effectiveView==='pagos'&&!membership&&<section className="card" role="status"><h2>{error?'No pudimos cargar tus planes.':'Consultando tus planes…'}</h2><p className="muted">Puedes reintentar la consulta sin cerrar tu sesión.</p><button className="button primary" disabled={busy} onClick={()=>void action(()=>loadAccess(user))}>{busy?'Consultando…':'Reintentar planes'}</button></section>}
        {effectiveView==='pagos'&&membership&&<PaymentCenter membership={membership} units={units} unitId={unitId} onChanged={()=>loadAccess(user)}/>}
        {active&&view==='alertas'&&unitId&&<MonitoringPage key={unitId} unitId={unitId} owner={manager}/>}
        {active&&view==='notificaciones'&&<NotificationsPage inbox={inbox}/>}
        {active&&!unitId&&!['perfil','privacidad','unidades','pagos','notificaciones','configuracion'].includes(view)?<Empty title={manager?'Comienza con una unidad':'Espera la asignación de tu unidad'}><p>{manager?'Crea tu unidad y añade un medidor para empezar. Si quieres explorar primero, la demostración prepara una unidad con consumo de todo el mes anterior y del mes actual hasta ayer.':'Comparte tu código de usuario con tu propietario para que te asigne una unidad. Solo verás las lecturas de tu período de alquiler. Tu cuenta también necesita su propio plan.'}</p><div className="button-row">{manager?<><button className="button primary" disabled={busy} onClick={()=>void action(prepareDemo)}><Icon name="plus"/>{busy?'Preparando…':'Preparar demostración'}</button><Link className="button secondary" href="/unidades">Crear mi unidad</Link></>:<Link href="/perfil" className="button primary">Ver mi código de usuario</Link>}</div><div className="onboarding-preview"><div><span>01</span>Tu espacio</div><Icon name="arrow"/><div><span>02</span>Medidores virtuales</div><Icon name="arrow"/><div><span>03</span>Agua en claro</div></div></Empty>:null}

        {active&&view==='dashboard'&&unitId&&<>
          <div className="overview-meta"><span><span className={'dot '+(data?.available&&!readingFailed&&!dataLoading?'teal':'gray')}/>{readingStatus}</span><span>{data?.lastReadingAt?'Última lectura · '+timestamp(data.lastReadingAt):'Medidores virtuales'}</span></div>
          <div className="metrics-grid">
            <Metric label="Consumo de este mes" value={data?liters(data.monthLiters):'—'} unit="L" icon="drop" detail={data?'Hoy: '+liters(data.todayLiters)+' L':'Esperando lecturas'} accent/>
            <Metric label="Costo estimado del mes" value={data?money(data.monthEstimate.total):'—'} icon="receipt" detail="Agua, saneamiento, cargo fijo e impuestos"/>
            <Metric label="Proyección al cierre" value={data?.projection?money(data.projection.cost):'—'} icon="chart" detail={data?.projection?'Según el promedio de días completos':'Requiere al menos 7 días completos'}/>
            <Metric label="Medidores activos" value={devicesLoaded?String(devices.filter(d=>d.state==='active').length):'—'} unit={devicesLoaded?'/ '+devices.length:undefined} icon="meter" detail="De la unidad seleccionada"/>
          </div>
          <div className="dashboard-grid"><section className="card chart-card"><div className="card-heading"><div><h2>Consumo diario</h2><p>Últimos 31 días</p></div><Link href="/historial" className="text-link">Ver historial <Icon name="arrow"/></Link></div>{data?<ConsumptionChart daily={data.daily}/>:<p className="empty-small muted" role="status">{dataLoading?'Consultando consumo…':'El consumo no está disponible temporalmente. Reintenta la consulta.'}</p>}</section>
            <section className="card"><div className="card-heading"><div><h2>Consumo por zona</h2><p>{data?.totalSource==='legacy_sum'?'Suma heredada de medidores. Elige GENERAL desde Medidores.':'GENERAL define el total. Las zonas muestran su detalle.'}</p></div></div>{data?<DeviceBreakdown daily={data.meterDaily||data.daily} devices={devices} totalLiters={data.liters}/>:<p className="empty-small muted" role="status">{dataLoading?'Consultando distribución…':'La distribución no está disponible temporalmente.'}</p>}</section></div>
          <ConsumptionStatus goal={budgetGoal} loaded={goalLoaded} error={goalError}/>
          {data&&data.readingCount===0&&!dataLoading&&manager&&<div className="callout"><span><strong>Tu panel está listo. Faltan las lecturas.</strong><small>Prepara medidores de ejemplo o activa los que ya creaste.</small></span><button className="button primary" disabled={busy} onClick={()=>void action(prepareDemo)}>Generar demostración <Icon name="arrow"/></button></div>}
          <section className="card cost-card monthly-cost"><div className="card-heading"><div><h2>Detalle del estimado mensual</h2><p>{data?.tariffName||'Tarifa de la unidad'} · {data?liters(data.monthLiters/1000):'—'} m³ registrados</p></div><Link href="/tarifas" className="text-link">Ver cálculo y tarifa <Icon name="arrow"/></Link></div><div className="bill-breakdown"><div className="cost-row"><span>Agua potable</span><strong>{data?money(data.monthEstimate.water):'—'}</strong></div><div className="cost-row"><span>Saneamiento</span><strong>{data?money(data.monthEstimate.sewer):'—'}</strong></div><div className="cost-row"><span>Cargo fijo mensual</span><strong>{data?money(data.monthEstimate.fixedCharge):'—'}</strong></div><div className="cost-row"><span>IGV {data?liters(Number(data.monthEstimate.taxRate||0)*100):'—'}%</span><strong>{data?money(data.monthEstimate.tax||0):'—'}</strong></div><div className="cost-row total"><span>Total estimado</span><strong>{data?money(data.monthEstimate.total):'—'}</strong></div></div><small>Estimación con la tarifa configurada. El plan de HydroSmart se paga por separado. No es un recibo de Sedapal.</small></section>
          <RecommendationsPanel data={data} devices={devices} loading={dataLoading} preview/>
          {manager&&<SimulationControls busy={busy} state={simulation} onAction={name=>void action(()=>simulate(name))}/>}
        </>}

        {active&&view==='recomendaciones'&&unitId&&<RecommendationsPanel data={data} devices={devices} loading={dataLoading}/>}
        {active&&view==='historial'&&unitId&&<>
          <p className="muted small-text">Prepara y descarga tu reporte en <a className="text-link" href="#mis-reportes">Mis reportes</a>, al final de la página.</p>
          <form className="filter-bar card" onSubmit={e=>{e.preventDefault();if(from>to){setError('La fecha inicial debe ser anterior a la final.');return;}setError('');setPeriod({from,to});}}>
            <Field label="Desde"><input type="date" value={from} required max={to} min={daysAgo(365)} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Hasta"><input type="date" value={to} required min={from} max={localDate()} onChange={e=>setTo(e.target.value)}/></Field><button className="button primary" disabled={dataLoading}>Aplicar período</button>
          </form>
          <div className="history-summary"><span><strong>{data?liters(data.liters):'—'} L</strong> registrados en el período</span><span><strong>{data?money(data.estimate.total):'—'}</strong> estimados · {data?liters(data.readingCount):'—'} lecturas</span></div>
          {data?.estimate.months&&data.estimate.months.length>1&&<section className="card"><h2>Estimado por mes y tarifa</h2>{data.estimate.months.map(item=><div className="cost-row" key={item.month}><span>{monthLabel(item.month)} · {item.tariffName}</span><strong>{money(item.total)}</strong></div>)}</section>}
          <section className="card"><div className="card-heading"><div><h2>Historial de consumo</h2><p>{period.from} — {period.to} · las fechas incluyen todo el día en Lima</p></div>{dataLoading&&<span className="muted">Actualizando…</span>}</div>{data?<ConsumptionChart daily={data.daily}/>:<p className="empty-small muted" role="status">{dataLoading?'Consultando consumo…':'El consumo no está disponible temporalmente. Reintenta la consulta.'}</p>}</section>
          <ComparisonPanel data={data} loading={dataLoading}/>
          <section className="card table-card"><div className="card-heading"><div><h2>Detalle por día y medidor</h2><p>Lecturas por medidor. GENERAL define el total de la unidad y las zonas muestran su detalle.</p></div></div><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Medidor</th><th>Lecturas</th><th className="numeric">Consumo</th></tr></thead><tbody>{[...(data?.meterDaily||data?.daily||[])].reverse().map(row=><tr key={row.date+row.deviceId}><td>{row.date}</td><td>{devices.find(d=>d.id===row.deviceId)?.name||'Medidor archivado'}</td><td className="numeric">{liters(row.readingCount)}</td><td className="numeric strong">{liters(row.liters)} L</td></tr>)}</tbody></table>{data&&!(data.meterDaily||data.daily).length&&<p className="table-empty">No hay lecturas registradas para estas fechas.</p>}</div><p className="table-footnote">El estimado suma cada mes con lecturas usando la tarifa vigente en ese mes y su cargo fijo. GENERAL define el consumo total. No equivale a una factura oficial.</p></section>
        </>}

        {active&&view==='historial'&&unitId&&<ReportJobs key={unitId} unitId={unitId} from={period.from} to={period.to}/>}
        {active&&view==='unidades'&&<UnitManagement user={user} units={units} properties={properties} unitId={unitId} busy={busy} refresh={refresh} onChoose={chooseUnit} onReload={()=>loadUnits(user)} work={action} notify={setNotice} error={error}/>}
        {active&&view==='dispositivos'&&unitId&&<>
          <MeterManagement devices={devices} inventoryAvailable={devicesLoaded} loading={dataLoading} data={data} unitId={unitId} unitName={selected?.name||''} owner={manager} busy={busy} capacity={membership?.devices?{count:membership.devices.count,limit:membership.deviceLimit}:null} onReload={()=>loadAccess(user)} work={action} notify={setNotice} error={error}/>
          {manager&&<SimulationControls busy={busy} state={simulation} onAction={name=>void action(()=>simulate(name))}/>}
        </>}
        {active&&view==='tarifas'&&unitId&&<TariffPage key={unitId} unitId={unitId} unitName={selected?.name||''} owner={manager}/>}

        {view==='perfil'&&<div className="profile-layout"><section className="card"><AccountSecurity user={user} onUpdated={setUser}><div className="form-divider"/><form className="stacked-form" onSubmit={e=>submit(e,async form=>{const name=String(form.get('name')).trim();await authRequest('update-user',{name});setUser({...user,name});setNotice('Tu nombre fue actualizado.');})}><Field label="Nombre completo"><input name="name" defaultValue={user.name} maxLength={120} minLength={2} required/></Field><Field label="Correo electrónico" hint="El correo identifica tu cuenta."><input value={user.email} type="email" readOnly/></Field><button className="button primary" disabled={busy}>Guardar nombre</button></form></AccountSecurity></section>
          <section className="card"><Icon name="shield"/><h2>Tu código de usuario</h2><p className="muted">{user.profileType==='inquilino'?'Compártelo con tu propietario para que te asigne una unidad.':'Este código identifica tu cuenta dentro de HydroSmart.'}</p><code className="user-code">{user.id}</code><button className="button secondary" onClick={()=>void action(async()=>{await navigator.clipboard.writeText(user.id);setCopied(true);})}>{copied?'Código copiado':'Copiar código'}</button><div className="form-divider"/><h3>Acceso a tu información</h3><p className="muted small-text">Tu perfil define qué unidades y lecturas puedes consultar. Las credenciales de otros servicios no se exponen en el navegador.</p><Link href="/privacidad" className="text-link">Consultar privacidad <Icon name="arrow"/></Link></section></div>}
        {view==='configuracion'&&<SettingsPage user={user} active={active}/>}
        {view==='privacidad'&&<section className="card privacy-copy"><small>Proyecto académico</small><h2>Datos que guarda HydroSmart</h2><p>HydroSmart guarda tu nombre, correo, tipo de perfil y sesiones para autenticar tu cuenta; las propiedades, unidades y asignaciones que registres; y las lecturas generadas, junto con sus medidores y tarifas.</p><h3>Quién puede consultar los datos</h3><p>El propietario administra sus unidades. El propietario también asigna cada unidad a su inquilino. El inquilino consulta las lecturas de su unidad desde el inicio de su alquiler; al finalizarlo pierde ese acceso.</p><h3>Datos simulados y estimaciones</h3><p>Esta versión no recibe datos de sensores físicos. Los generadores crean lecturas de ejemplo que se guardan en las bases locales. Los costos usan la tarifa configurada por unidad. La referencia de Sedapal está fechada y puede diferir de tu recibo según categoría, distrito y subsidio.</p><h3>Opciones disponibles</h3><p>Puedes editar tu nombre en Mi perfil, descargar reportes PDF o CSV desde Historial, pausar la generación y desactivar medidores. Cerrar sesión termina la sesión del navegador; los JWT emitidos pueden seguir siendo válidos hasta 5 minutos.</p><div className="privacy-actions"><Link href="/perfil" className="button secondary">Editar mi perfil</Link><Link href="/historial" className="button secondary">Descargar mi historial</Link></div><p className="muted small-text">Puedes solicitar la eliminación desde Configuración, con tu contraseña y una confirmación. El propietario debe finalizar sus asignaciones activas y cada cuenta debe resolver sus pagos pendientes. La cuenta pierde acceso inmediatamente; los servicios borran sus datos por RabbitMQ con reintentos. Los pagos se conservan sin nombre, correo, cuenta, unidad ni referencias de Stripe durante 365 días desde el borrado y después se purgan. Se conservan marcadores técnicos no reversibles para impedir que mensajes antiguos restauren datos eliminados.</p><h3>Copias y proveedores externos</h3><p>El borrado alcanza las bases activas de esta demostración local. No retira archivos que hayas descargado ni borra registros externos de Stripe o Brevo. Las copias manuales del desarrollador, los mensajes pendientes y los registros operativos se gestionan por separado. Una copia anterior no debe restaurarse sin reaplicar los borrados. Esta política de 365 días es una decisión del proyecto; los avisos legales para un servicio público requieren una revisión específica.</p></section>}
        {!['dashboard','historial','unidades','dispositivos','tarifas','perfil','privacidad','configuracion','recomendaciones','pagos','alertas','notificaciones'].includes(view)&&<Empty title="Esta página no existe."><p>Vuelve al Dashboard para continuar.</p><Link href="/" className="button primary">Ir al Dashboard</Link></Empty>}
        </>}
        <footer className="app-footer"><span>HydroSmart · Medidores virtuales</span><span>Lecturas simuladas · Costos estimados en soles</span></footer>
      </main>
    </div>
  </div>;
}
function Metric({label,value,unit,icon,detail,accent=false}:{label:string;value:string;unit?:string;icon:string;detail:string;accent?:boolean}) {
  return <section className={'metric '+(accent?'accent':'')}><div className="metric-label"><span>{label}</span><Icon name={icon}/></div><div className="metric-value">{value} {unit&&<span>{unit}</span>}</div><small>{detail}</small></section>;
}
function SimulationControls({busy,state,onAction}:{busy:boolean;state:Simulation;onAction:(name:string)=>void}) {
  return <><section className="simulation-toggle"><span><span className={'dot '+(state.running?'teal':'gray')}/>{state.running?'Lecturas simuladas activas · cada 10 segundos':'Lecturas simuladas pausadas'}</span><button className="button secondary" disabled={busy} onClick={()=>onAction(state.running?'pause':'start')}>{state.running?'Pausar generación':'Iniciar generación'}</button></section><details className="simulation-advanced"><summary>Datos de demostración</summary><section className="generator-bar"><p>Genera consumo de todo el mes anterior y del mes actual hasta ayer. Así podrás probar el pago del mes cerrado en Plan y pagos. No duplica lecturas ya generadas.</p><button className="button secondary" disabled={busy||state.seeding} onClick={()=>{if(window.confirm('¿Generar consumo del mes anterior completo y del mes actual hasta ayer? Se conservarán tus datos existentes.'))onAction('seed');}}>{state.seeding?'Preparando historial…':'Generar historial y mes anterior'}</button></section></details></>;
}
function AuthScreen({register,error:initialError,onSuccess}:{register:boolean;error:string;onSuccess:(user:User)=>Promise<void>}) {
  const [error,setError]=useState(initialError);const [busy,setBusy]=useState(false);const [profile,setProfile]=useState('propietario');const [deletionTicket,setDeletionTicket]=useState('');
  useEffect(()=>{const query=new URLSearchParams(location.search),p=query.get('profile'),ticket=query.get('accountDeleted');if(p&&['propietario','inquilino'].includes(p))setProfile(p);if(ticket&&/^[0-9a-f-]{36}$/i.test(ticket))setDeletionTicket(ticket);},[]);
  const [siteKey,setSiteKey]=useState<string|null>();
  const [challengeError,setChallengeError]=useState(false);
  const [challengeToken,setChallengeToken]=useState('');
  const resetChallenge=useRef<() => void>(null);
  const canRegister=siteKey===null || Boolean(siteKey && challengeToken);
  useEffect(()=>{
    if(!register)return;
    let active=true;
    authRequest('registration-challenge').then(result=>{
      if(!active)return;
      if(result?.siteKey===null || (typeof result?.siteKey==='string' && result.siteKey))setSiteKey(result.siteKey);
      else setChallengeError(true);
    }).catch(()=>{if(active)setChallengeError(true);});
    return ()=>{active=false;};
  },[register]);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(busy || (register && !canRegister))return;setError('');
    const form=new FormData(e.currentTarget);
    if(register){const invalid=passwordError(String(form.get('password')),String(form.get('confirmPassword')));if(invalid){setError(invalid);return;}}
    setBusy(true);
    try {
      const result=await authRequest(register?'sign-up/email':'sign-in/email',{email:String(form.get('email')).trim(),password:form.get('password'),
        ...(register?{name:String(form.get('name')).trim(),profileType:profile,confirmPassword:form.get('confirmPassword')}:{rememberMe:true})},
        register&&challengeToken?{'x-captcha-response':challengeToken}:undefined);
      await onSuccess(result.user);
    } catch(e){setError(messageOf(e));} finally{
      if(register)resetChallenge.current?.();
      setBusy(false);
    }
  }
  return <main className="auth-layout"><section className="auth-story"><a href="/" className="brand-link"><Brand/></a><div className="auth-story-copy"><p className="auth-headline">Gestiona el agua de <em>tu hogar</em></p><p>Observa tu consumo, conoce su costo y encuentra un ritmo que tenga sentido para tu hogar.</p><span className="auth-demo-tag"><span className="pulse-dot"/>Demostración con medidores virtuales</span></div><small>HydroSmart · Proyecto académico</small></section>
    <section className="auth-form-area"><a href="/" className="back-link">← Volver al inicio</a><div className="auth-form-wrap"><h1>{register?'Crear cuenta':'Iniciar sesión'}</h1><p className="muted">{register?'Crea tu cuenta y empieza a explorar tus datos.':'Ingresa a tu espacio y revisa cómo va tu consumo.'}</p>{deletionTicket&&<div className="message success" role="status">Tu solicitud de eliminación fue recibida. El acceso a la cuenta ya está cerrado; el borrado continuará en segundo plano. Referencia: {deletionTicket}</div>}{error&&<div className="message error" role="alert">{error}</div>}
      <form className="stacked-form" method="post" onSubmit={submit}>{register&&<><Field label="Nombre completo"><input name="name" autoComplete="name" placeholder="¿Cómo te llamas?" minLength={2} maxLength={120} required/></Field><Field label="Usaré HydroSmart como"><select value={profile} onChange={e=>setProfile(e.target.value)}><option value="propietario">Propietario · hogares y unidades</option><option value="inquilino">Inquilino · una unidad asignada</option></select></Field></>}
      <Field label="Correo electrónico"><input name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" maxLength={254}/></Field><Field label="Contraseña" hint={register?passwordHint:undefined}><PasswordInput name="password" autoComplete={register?'new-password':'current-password'} minLength={register?12:1} maxLength={128} pattern={register?passwordPattern:undefined} required placeholder={register?'Crea una contraseña segura':'Tu contraseña'}/></Field>
      {register&&<Field label="Repetir contraseña"><PasswordInput name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Escribe otra vez tu contraseña"/></Field>}
      {register&&siteKey===undefined&&<p className="small-text muted" role="status">{challengeError?'No pudimos cargar la verificación. Actualiza la página para volver a intentarlo.':'Cargando verificación de seguridad…'}</p>}
      {register&&siteKey&&<RegistrationChallenge siteKey={siteKey} onToken={setChallengeToken} ref={resetChallenge}/>}
      {register&&<p className="small-text muted">Al crear tu cuenta, podrás consultar cómo se guardan y usan tus datos en la sección Privacidad.</p>}<button className="button primary full" disabled={busy || (register && !canRegister)}>{busy?'Un momento…':register?'Crear mi cuenta':'Iniciar sesión'}<Icon name="arrow"/></button></form>
      {!register&&<p className="auth-switch"><Link href="/forgot-password">Olvidé mi contraseña</Link></p>}
      <p className="auth-switch">{register?'¿Ya tienes una cuenta?':'¿Aún no tienes una cuenta?'} <Link href={register?'/login':'/register'}>{register?'Inicia sesión':'Crea tu cuenta'}</Link></p><div className="auth-trust"><Icon name="shield"/>Tu sesión se guarda en una cookie del navegador.</div></div></section></main>;
}

