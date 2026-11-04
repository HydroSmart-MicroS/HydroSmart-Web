'use client';
import Link from 'next/link';
import {useCallback,useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {api,apiDownload,messageOf} from '../lib/api';
import {liters,money,timestamp,localDate,monthLabel,type Unit,type Goal} from '../lib/types';
import {Field,Icon} from './Ui';
import styles from './Payments.module.css';

type Plan={code:string;priceMinor:number;deviceLimit:number};
export type Membership={active:boolean;planCode:string|null;paidThrough:string|null;deviceLimit:number;cancelAtPeriodEnd?:boolean;plans?:Plan[];devices:null|{count:number;items:{id:string;name:string;unit_id:string;managed:boolean}[]}};
type WaterQuote={unitId:string;month:string;liters:number;estimate:{water:string;sewer:string;fixedCharge:string;tax?:string;taxRate?:string;total:string};amountMinor:number;payable:boolean;reason:string;invoiceStatus?:string};
type Order={id:string;kind:string;plan_code:string|null;unit_id?:string;invoice_month:string|null;amount_minor:number;status:string;created_at:string;checkout_url:string|null};
function previousMonth(){const [y,m]=localDate().split('-').map(Number);return new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);}
function ErrorMessage({value}:{value:string}){return value?<div className="message error" role="alert">{value}</div>:null;}
const planName=(code:string|null)=>code==='premium'?'Premium':code==='black'?'Black':code||'Sin plan';
const statusLabel:Record<string,string>={creating:'Preparando',pending:'Pendiente',paid:'Pagado',failed:'Fallido',cancelled:'Anulado',completed:'Completado'};
function paymentMessage(order:Order){return order.status==='paid'?(order.kind==='plan'?'Pago confirmado. Tu plan ya está actualizado.':'Pago de agua confirmado.'):
  order.status==='failed'?'Este enlace de pago venció. Genera un nuevo enlace para volver a pagar.':order.status==='cancelled'?'Este pago está anulado.':'El proveedor todavía no confirma el pago. Puedes continuar el pago o volver a verificar.';}
export function PaymentCenter({membership,units,unitId,onChanged}:{membership:Membership;units:Unit[];unitId:string;onChanged:()=>Promise<void>}) {
  const [section,setSection]=useState<'plan'|'water'|'history'>('plan');
  const [quote,setQuote]=useState<WaterQuote|null>(null),[quoteLoading,setQuoteLoading]=useState(false),[quoteError,setQuoteError]=useState(''),[quoteRevision,setQuoteRevision]=useState(0);
  const [orders,setOrders]=useState<Order[]>([]),[ordersLoading,setOrdersLoading]=useState(true),[ordersError,setOrdersError]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[selectedPlan,setSelectedPlan]=useState<string|null>(null);
  const [unit,setUnit]=useState(unitId),[month,setMonth]=useState(previousMonth());
  const returning=useRef(''),locked=useRef(false),orderRequest=useRef(0),changed=useRef(onChanged);
  changed.current=onChanged;
  const plans=membership.plans||[],currentPlan=plans.find(p=>p.code===membership.planCode),selected=plans.find(p=>p.code===selectedPlan);
  const count=membership.devices?.count,needsCapacity=!!selected&&(count===undefined||count>selected.deviceLimit);
  const currentQuote=quote?.unitId===unit&&quote.month===month?quote:null;
  const pending=orders.filter(o=>o.status==='pending');
  const latestPlanOrder=orders.find(o=>o.kind==='plan');
  const earliestMonth=new Date(Date.UTC(Number(localDate().slice(0,4)),Number(localDate().slice(5,7))-13,1)).toISOString().slice(0,7);
  useEffect(()=>{setUnit(unitId);setQuote(null);},[unitId]);
  const refresh=useCallback(async()=>{
    const request=++orderRequest.current;setOrdersLoading(true);
    try{const result=await api<Order[]>('billing/orders');if(request===orderRequest.current){setOrders(result);setOrdersError('');}}
    catch(e){if(request===orderRequest.current)setOrdersError(messageOf(e));throw e;}
    finally{if(request===orderRequest.current)setOrdersLoading(false);}
  },[]);
  useEffect(()=>{void refresh().catch(()=>{});return()=>{orderRequest.current++;};},[refresh]);
  const work=useCallback(async(fn:()=>Promise<void>)=>{
    if(locked.current)return false;
    locked.current=true;setBusy(true);setError('');setNotice('');let failure='';
    try{await fn();}catch(e){failure=messageOf(e);}
    // A rejected cancellation can still confirm a payment; reload its actual state.
    const updates=await Promise.allSettled([refresh(),changed.current()]);
    if(!failure){const failed=updates.find(r=>r.status==='rejected');if(failed?.status==='rejected')failure=messageOf(failed.reason);}
    setQuoteRevision(n=>n+1);setError(failure);locked.current=false;setBusy(false);return !failure;
  },[refresh]);
  useEffect(()=>{
    if(!pending.length)return;
    let running=false;
    async function update(){
      if(document.hidden||locked.current||running)return;
      running=true;
      // Read orders first so a confirmed payment cannot stop polling with stale access.
      try{await refresh();await changed.current();}catch(e){setError(messageOf(e));}
      finally{running=false;}
    }
    const timer=setInterval(()=>void update(),10000);
    window.addEventListener('focus',update);
    return()=>{clearInterval(timer);window.removeEventListener('focus',update);};
  },[pending.length,refresh]);
  useEffect(()=>{
    if(section!=='water'||!membership.active||!unit||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){setQuote(null);setQuoteLoading(false);setQuoteError('');return;}
    let live=true,running=false;setQuote(null);setQuoteError('');
    async function load(){
      if(running)return;running=true;if(live)setQuoteLoading(true);
      try{const result=await api<WaterQuote>('billing/quote/water?unitId='+encodeURIComponent(unit)+'&month='+encodeURIComponent(month));if(live){setQuote(result);setQuoteError('');}}
      catch(e){if(live){setQuote(null);setQuoteError(messageOf(e));}}
      finally{running=false;if(live)setQuoteLoading(false);}
    }
    void load();const timer=setInterval(()=>{if(!document.hidden)void load();},30000);
    return()=>{live=false;clearInterval(timer);};
  },[section,membership.active,unit,month,quoteRevision]);
  function cancelPlan(){
    if(!window.confirm('¿Cancelar el plan al terminar tu período pagado? Mantendrás el acceso hasta '+timestamp(membership.paidThrough)+'.'))return;
    void work(async()=>{await api('billing/plan/cancellation','POST',{});setNotice('Cancelación programada. Tu acceso se conserva hasta el vencimiento.');});
  }
  function cancelOrder(id:string){
    if(!window.confirm('¿Anular este pago pendiente? Su enlace dejará de aceptar pagos. Puedes preparar otro después.'))return;
    void work(async()=>{await api('billing/orders/'+id+'/cancel','POST',{});setNotice('Pago pendiente anulado. Su enlace de pago quedó cerrado.');});
  }
  async function verify(id:string){
    const order=await api<Order>('billing/orders/'+id+'/verify','POST',{});
    setNotice(paymentMessage(order));return order;
  }
  useEffect(()=>{
    const id=new URLSearchParams(location.search).get('orderId');
    if(!id||returning.current===id)return;returning.current=id;
    setSection('history');void work(async()=>{await verify(id);}).then(ok=>{if(ok)history.replaceState(null,'',location.pathname);});
  },[work]);
  function checkout(url:string|null){if(!url)throw new Error('El proveedor aún no preparó el enlace de pago.');const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='checkout.stripe.com')throw new Error('Enlace de pago inválido.');location.assign(parsed.href);}
  function openOrder(order:Order){if(order.status==='pending')checkout(order.checkout_url);else setNotice(paymentMessage(order));}
  function selectPlan(code:string){
    const plan=plans.find(p=>p.code===code);if(!plan||busy)return;
    setSection('plan');setSelectedPlan(code);
    if(count===undefined){setError('No pudimos consultar tus medidores. Pulsa Reintentar capacidad antes de pagar.');return;}
    if(count>plan.deviceLimit){
      setNotice('Elegiste '+planName(code)+'. Desactiva '+(count-plan.deviceLimit)+' medidores para ajustarte a su capacidad; conservarás su historial.');
      return;
    }
    void work(async()=>{const order=await api<Order>('billing/checkout/plan','POST',{planCode:code});openOrder(order);});
  }
  useEffect(()=>{if(needsCapacity){const target=document.getElementById('plan-devices');target?.scrollIntoView({behavior:'smooth',block:'nearest'});target?.focus({preventScroll:true});}},[needsCapacity,selectedPlan]);
  return <div className={'feature-stack '+styles.payments}>
    <section className={'card '+styles.overview}><div><span className="badge">PAGOS DE PRUEBA</span><h2>{membership.active?'Tu plan está activo.':membership.paidThrough?'Tu plan venció.':'Elige tu plan para empezar'}</h2><p>{membership.active?planName(membership.planCode)+' · acceso hasta '+timestamp(membership.paidThrough):'El plan habilita HydroSmart. El consumo de agua se paga por separado.'}</p></div>{membership.active&&<div className={styles.capacity}><strong>{count??'—'} / {membership.deviceLimit}</strong><span>medidores habilitados</span></div>}</section>
    <nav className={styles.sections} aria-label="Secciones de pagos">{([['plan','Mi plan'],['water','Consumo de agua'],['history','Historial de pagos']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>{setSection(key);setError('');setNotice('');}}>{label}{key==='history'&&pending.length>0&&<span>{pending.length} pendiente{pending.length!==1?'s':''}</span>}</button>)}</nav>
    <ErrorMessage value={error}/>{notice&&<div className="message success" role="status">{notice}</div>}
    {pending.length>0&&section!=='history'&&<div className={styles.pending}><span>Tienes {pending.length} pago{pending.length!==1?'s':''} pendiente{pending.length!==1?'s':''}. Si ya pagaste, pulsa Verificar pago en el historial. Actualizamos el estado automáticamente cada 10 segundos.</span><button className="text-link" onClick={()=>setSection('history')}>Ver pagos pendientes <Icon name="arrow"/></button></div>}
    {section==='plan'&&<>
      {!membership.active?<><div className={styles.intro}><h2>¿Cuántos medidores necesitas?</h2><p>Ambos planes incluyen historial, alertas, metas y reportes. Cada cuenta paga su propio plan.</p></div><div className="plan-grid">{plans.map(p=><section className={'card plan-card '+(p.code==='black'?'black-plan':'')} key={p.code}><h3>{planName(p.code)}</h3><h2>{money(p.priceMinor/100)}<small> / mes</small></h2><p><strong>{p.deviceLimit} {p.deviceLimit===1?'medidor':'medidores'}</strong> entre todos tus espacios.</p><button className="button primary full" disabled={busy} onClick={()=>selectPlan(p.code)}>{busy?'Un momento…':'Elegir '+planName(p.code)}</button></section>)}</div>{!plans.length&&<ErrorMessage value="No pudimos cargar los precios de los planes. Reintenta antes de pagar."/>}<p className="muted small-text">El siguiente paso abre Stripe en modo de pruebas. Tu plan se activa cuando se confirma el pago.</p></>:
      <section className="card"><div className="card-heading"><div><h2>Plan {planName(membership.planCode)}</h2><p>{currentPlan?money(currentPlan.priceMinor/100)+' por mes · ':''}{membership.deviceLimit} {membership.deviceLimit===1?'medidor incluido':'medidores incluidos'}</p></div>{!membership.cancelAtPeriodEnd&&<button className="button primary" disabled={busy||!currentPlan} onClick={()=>selectPlan(membership.planCode!)}>Renovar un mes</button>}</div><p className="muted small-text">La renovación es manual y añade un mes al vencimiento actual. No hay cobros automáticos.</p>{membership.cancelAtPeriodEnd?<div className={styles.cancellation}><h2>Cancelación programada</h2><p>Conservas el acceso hasta {timestamp(membership.paidThrough)}.</p><button className="button secondary" disabled={busy} onClick={()=>void work(async()=>{await api('billing/plan/cancellation','DELETE');setNotice('Cancelación retirada. Puedes renovar tu plan.');})}>Conservar mi plan</button></div>:<details className={styles.details}><summary>Gestionar renovación</summary><p>Cancelar programa el fin de tu plan al vencer. Conservarás el período pagado.</p><button className="button secondary" disabled={busy} onClick={cancelPlan}>Cancelar plan</button></details>}<details className={styles.details}><summary>Comparar planes</summary><p>{plans.map(p=>planName(p.code)+': '+money(p.priceMinor/100)+' por mes y '+p.deviceLimit+' medidor(es).').join(' ')} Puedes cambiar al vencer tu plan.</p></details></section>}
      {(selected||count===undefined)&&<section id="plan-devices" className="card" tabIndex={-1}><h2>Medidores y capacidad</h2>{selected&&<div className={styles.capacityChoice}><strong>Plan elegido: {planName(selected.code)} · {selected.deviceLimit} {selected.deviceLimit===1?'medidor':'medidores'}</strong><p>{count===undefined?'Necesitamos comprobar tu capacidad antes de abrir el pago.':count>selected.deviceLimit?'Desactiva '+(count-selected.deviceLimit)+' medidores antes de continuar. El historial se conserva.':'Tu cuenta ya cumple la capacidad de este plan.'}</p><button className="button primary" disabled={busy||count===undefined||count>selected.deviceLimit||(membership.active&&membership.cancelAtPeriodEnd===true)} onClick={()=>selectPlan(selected.code)}>Continuar con {planName(selected.code)}</button></div>}<p className="muted small-text">{count===undefined?'No pudimos consultar tus medidores.':count+' medidores asociados a tu cuenta.'} Los desactivados no ocupan capacidad.</p>{count===undefined&&<button className="button secondary" disabled={busy} onClick={()=>void work(async()=>{})}>Reintentar capacidad</button>}{membership.devices?.items.map(d=><div className="feature-row" key={d.id}><span>{d.name}<small>{units.find(u=>u.id===d.unit_id)?.name||'Unidad asociada'} · {d.managed?'administrado por ti':'lo administra su propietario'}</small></span>{d.managed&&<button className="button secondary" disabled={busy} onClick={()=>void work(async()=>{await api('billing/devices/'+d.id,'DELETE');setNotice('Medidor desactivado. Su historial se conserva.');})}>Desactivar</button>}</div>)}</section>}
    </>}
    {section==='water'&&(!membership.active?<section className="card"><h2>Activa un plan para consultar tu consumo</h2><p className="muted">Después podrás seleccionar una unidad y revisar el importe de cada mes.</p><button className="button primary" onClick={()=>setSection('plan')}>Ver planes</button></section>:!units.length?<section className="card"><h2>Todavía no tienes una unidad</h2><p className="muted">El consumo se consulta por unidad. Prepara tus espacios o pide al propietario que te asigne uno.</p><Link className="button primary" href="/unidades">Ir a Unidades</Link></section>:<section className="card"><h2>Pagar consumo de agua</h2><p className="muted small-text">Selecciona una unidad y un mes. Verás el desglose antes de pagar. El plan de HydroSmart no está incluido en este importe.</p>
      <form className="stacked-form" onSubmit={e=>{e.preventDefault();if(busy||quoteLoading||!currentQuote?.payable)return;void work(async()=>{const order=await api<Order>('billing/checkout/water','POST',{unitId:unit,month});openOrder(order);});}}>
       <div className="two-columns"><Field label="Unidad"><select required disabled={busy} value={unit} onChange={e=>{setUnit(e.target.value);setQuote(null);}}><option value="" disabled>Selecciona una unidad</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Mes de consumo"><input type="month" required disabled={busy} value={month} min={earliestMonth} max={localDate().slice(0,7)} onChange={e=>{setMonth(e.target.value);setQuote(null);}}/></Field></div>
       <ErrorMessage value={quoteError}/><div className="water-quote" aria-live="polite">{quoteLoading&&!currentQuote?<p>Calculando consumo…</p>:currentQuote?<><div className="cost-row"><span>Consumo registrado</span><strong>{liters(currentQuote.liters)} L · {liters(currentQuote.liters/1000)} m³</strong></div>{!currentQuote.invoiceStatus&&<><div className="cost-row"><span>Agua</span><strong>{money(currentQuote.estimate.water)}</strong></div><div className="cost-row"><span>Saneamiento</span><strong>{money(currentQuote.estimate.sewer)}</strong></div><div className="cost-row"><span>Cargo fijo mensual</span><strong>{money(currentQuote.estimate.fixedCharge)}</strong></div>{currentQuote.estimate.tax!==undefined&&<div className="cost-row"><span>IGV{currentQuote.estimate.taxRate?' · '+Number(currentQuote.estimate.taxRate)*100+'%':''}</span><strong>{money(currentQuote.estimate.tax)}</strong></div>}</>}<div className="cost-row total"><span>{currentQuote.invoiceStatus?'Importe de la orden':'Total estimado'}</span><strong>{money(currentQuote.amountMinor/100)}</strong></div>{currentQuote.invoiceStatus&&<p className="muted small-text">Orden ya emitida: conserva su importe original. El desglose de la tarifa actual no modifica este pago.</p>}<p className="muted small-text">{currentQuote.reason}</p></>:<p className="muted">Selecciona una unidad y un mes para ver su importe.</p>}</div>
       {quoteError&&<button type="button" className="button secondary" disabled={busy||quoteLoading} onClick={()=>setQuoteRevision(n=>n+1)}>Reintentar cálculo</button>}<button className="button primary" disabled={busy||quoteLoading||!currentQuote?.payable}>{quoteLoading?'Calculando…':'Pagar consumo'}</button><p className="muted small-text">Solo se pagan meses cerrados de los últimos 12 meses. El mes con alquiler parcial lo gestiona el propietario. No se crean cobros automáticamente.</p>
      </form></section>)}
    {section==='history'&&<section className="card"><div className="card-heading"><div><h2>Mis pagos</h2><p>Planes y consumo de agua, con su estado de pago.</p></div><button className="text-link" disabled={busy||ordersLoading} onClick={()=>void work(async()=>{})}>Actualizar</button></div><ErrorMessage value={ordersError}/>{ordersLoading&&!orders.length?<p className="muted">Cargando pagos…</p>:!orders.length&&!ordersError?<p className="muted">Todavía no tienes órdenes de pago.</p>:null}{orders.map(o=><article className="feature-row" key={o.id}><div><strong>{o.kind==='plan'?'Plan '+planName(o.plan_code):'Agua · '+monthLabel(o.invoice_month)}</strong><small>{o.kind==='water'?(units.find(u=>u.id===o.unit_id)?.name||'Unidad')+' · ':''}{timestamp(o.created_at)} · {money(o.amount_minor/100)}</small><span className="badge">{o.kind==='plan'&&o.status==='failed'&&o.id!==latestPlanOrder?.id?'Intento anterior':statusLabel[o.status]||o.status}</span>{o.kind==='plan'&&o.status==='failed'&&o.id!==latestPlanOrder?.id&&<small>Este intento se conserva como historial. Su enlace ya no admite pagos.</small>}</div><div className="button-row">{o.kind==='plan'&&o.status==='failed'&&o.id===latestPlanOrder?.id&&o.plan_code&&<button className="button primary" disabled={busy} onClick={()=>selectPlan(o.plan_code!)}>Generar nuevo enlace</button>}{o.status==='pending'&&<button className="button primary" disabled={busy} onClick={()=>void work(async()=>openOrder(await verify(o.id)))}>Continuar pago</button>}{(o.status==='pending'||(o.kind==='plan'&&o.status==='paid'))&&<button className="button secondary" disabled={busy} onClick={()=>void work(async()=>{await verify(o.id);})}>Verificar pago</button>}{o.status==='pending'&&<button className="button secondary" disabled={busy} onClick={()=>cancelOrder(o.id)}>Anular pago</button>}</div></article>)}</section>}
  </div>;
}

type Notice={id:string;title:string;body:string;kind:string;created_at:string;read_at:string|null};
type Inbox={items:Notice[];unreadCount:number;nextCursor?:string|null;emailConfigured:boolean;email:{pending:number;failed:number;accepted:number}};
export function useInbox(enabled:boolean){
 const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState(''),[loadingMore,setLoadingMore]=useState(false);
 const request=useRef(0),allowed=useRef(enabled),pages=useRef(1),moreLock=useRef(false);
 allowed.current=enabled;
 const refresh=useCallback(async()=>{
  if(!allowed.current)return;const revision=++request.current;
  try{
   let first:Inbox|null=null,cursor:string|null=null;
   const items=new Map<string,Notice>();
   for(let page=0;page<pages.current;page++){
    const next:Inbox=await api<Inbox>('notifications'+(cursor?'?before='+encodeURIComponent(cursor):''));
    if(!allowed.current||revision!==request.current)return;
    first ||= next;
    for(const item of next.items)items.set(item.id,item);
    cursor=next.nextCursor||null;
    if(!cursor)break;
   }
   if(first&&allowed.current&&revision===request.current){setData({...first,items:[...items.values()],nextCursor:cursor});setError('');}
  }catch(e){if(allowed.current&&revision===request.current)setError(messageOf(e));}
 },[]);
 const loadMore=useCallback(async()=>{
  if(moreLock.current||!allowed.current)return;
  moreLock.current=true;setLoadingMore(true);pages.current++;
  try{await refresh();}finally{moreLock.current=false;setLoadingMore(false);}
 },[refresh]);
 useEffect(()=>{
  if(!enabled){pages.current=1;setData(null);setError('');setLoadingMore(false);return;}
  void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},10000);
  return()=>{request.current++;clearInterval(timer);};
 },[enabled,refresh]);
 return {data,error,refresh,enabled,loadMore,loadingMore};
}
type InboxHook=ReturnType<typeof useInbox>;
export function NotificationBell({inbox}:{inbox:InboxHook}) {
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 const [open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState('');
 function close(){dialog.current?.close();setOpen(false);}
 async function read(id:string){setBusy(id);setError('');try{await api('notifications/'+id+'/read','POST',{});await inbox.refresh();}catch(e){setError(messageOf(e));}finally{setBusy('');}}
 return <><button type="button" className="notification-bell icon-button" aria-label={'Notificaciones: '+(inbox.data?.unreadCount||0)+' sin leer'} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setError('');dialog.current?.showModal();setOpen(true);void inbox.refresh();}}><Icon name="bell"/>{!!inbox.data?.unreadCount&&<span>{inbox.data.unreadCount}</span>}</button>
 <dialog ref={dialog} className="notification-preview" aria-labelledby={titleId} onClose={()=>setOpen(false)} onCancel={()=>setOpen(false)} onClick={e=>{if(e.target!==e.currentTarget)return;const box=e.currentTarget.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)close();}}>
  <div className="preview-heading"><div><h2 id={titleId}>Notificaciones</h2><small>{inbox.data?.unreadCount||0} sin leer</small></div><button className="icon-button" aria-label="Cerrar notificaciones" onClick={close}>×</button></div>
  <ErrorMessage value={error||inbox.error}/><div className="preview-items">{!inbox.enabled?<p>Activa un plan para consultar tus notificaciones.</p>:inbox.data===null&&!inbox.error?<p>Cargando notificaciones…</p>:!inbox.data?.items.length?<p>No tienes notificaciones todavía.</p>:inbox.data.items.slice(0,6).map(n=><article key={n.id} className={'preview-item '+(!n.read_at?'unread':'')}><strong>{n.title}</strong><p>{n.body}</p><small>{timestamp(n.created_at)}</small>{!n.read_at&&<button className="text-link" disabled={!!busy} onClick={()=>void read(n.id)}>Marcar leída</button>}</article>)}</div>
  <div className="preview-footer"><Link className="text-link" href={inbox.enabled?'/notificaciones':'/pagos'} onClick={close}>{inbox.enabled?'Ver todas las notificaciones':'Ver planes'} <Icon name="arrow"/></Link></div>
 </dialog></>;
}
const preferenceLabels:Record<string,string>={inAppEnabled:'Notificaciones en la aplicación',emailEnabled:'Enviar también por correo',highConsumptionEnabled:'Consumo inusual',leakAlertsEnabled:'Posible fuga',goalEnabled:'Meta mensual al 80%',summariesEnabled:'Avisos de reportes completados'};
export function NotificationsPage({inbox}:{inbox:InboxHook}){
 const [prefs,setPrefs]=useState<Record<string,boolean>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const lock=useRef(false);
 useEffect(()=>{let live=true;api<Record<string,boolean>>('notification-preferences').then(value=>{if(live)setPrefs(value);}).catch(e=>{if(live)setError(messageOf(e));});return()=>{live=false;};},[]);
 async function action(work:()=>Promise<void>){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
  try{await work();await inbox.refresh();}catch(e){setError(messageOf(e));}finally{lock.current=false;setBusy(false);}
 }
 return <div className="feature-stack">
  <ErrorMessage value={error||inbox.error}/>{notice&&<div className="message success" role="status">{notice}</div>}
  <section className="card">
   <div className="card-heading"><div><h2>Tu bandeja</h2><p>{inbox.data?.unreadCount||0} sin leer · actualiza cada 10 segundos</p></div><button className="text-link" onClick={()=>void inbox.refresh()}>Actualizar</button></div>
   {!inbox.data&&!inbox.error&&<p role="status">Consultando notificaciones…</p>}
   {inbox.data?.items.map(n=><article key={n.id} className={'feature-row notification-item '+(!n.read_at?'unread':'')}><div><strong>{n.title}</strong><p>{n.body}</p><small>{timestamp(n.created_at)}</small></div>{!n.read_at&&<button className="button secondary" disabled={busy} onClick={()=>void action(async()=>{await api('notifications/'+n.id+'/read','POST',{});})}>Marcar leída</button>}</article>)}
   {inbox.data&&!inbox.data.items.length&&!inbox.error&&<p className="muted">No tienes notificaciones todavía. Las alertas de tu unidad aparecerán aquí.</p>}
   {inbox.data?.nextCursor&&<div className="button-row inbox-pagination"><button className="button secondary" disabled={inbox.loadingMore||busy} onClick={()=>void inbox.loadMore()}>{inbox.loadingMore?'Cargando anteriores…':'Ver notificaciones anteriores'}</button></div>}
  </section>
  <section className="card"><h2>Cómo quieres recibirlas</h2>
   {prefs&&<form className="stacked-form" onSubmit={e=>{e.preventDefault();void action(async()=>{const saved=await api<Record<string,boolean>>('notification-preferences','PUT',prefs);setPrefs(saved);setNotice('Preferencias guardadas para los próximos avisos.');});}}>
    <fieldset disabled={busy}><div className="preference-grid">{Object.entries(preferenceLabels).map(([key,label])=><label className="check-label" key={key}><input type="checkbox" checked={prefs[key]||false} onChange={e=>setPrefs({...prefs,[key]:e.target.checked})}/>{label}</label>)}</div><button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar preferencias'}</button></fieldset>
   </form>}
  </section>
  <section className="card"><h2>Correo electrónico · Brevo</h2><p className="muted small-text">{inbox.data?.emailConfigured?'Proveedor configurado. «Aceptados» significa que Brevo aceptó el envío; revisa también spam.':'Falta configurar BREVO_API_KEY en el entorno local y reiniciar Notificaciones. Los correos permanecen en cola.'}</p><p className="email-counts">Pendientes: {inbox.data?.email.pending||0} · Aceptados: {inbox.data?.email.accepted||0} · Fallidos: {inbox.data?.email.failed||0}</p><button className="button secondary" disabled={busy||!inbox.data?.email.failed} onClick={()=>void action(async()=>{await api('notifications/email/retry','POST',{});setNotice('Correos fallidos puestos otra vez en cola.');})}>Reintentar fallidos</button></section>
 </div>;
}
type Rules={highEnabled:boolean;thresholdLiters:string;windowSeconds:number;leakEnabled:boolean;leakWindowSeconds:number;normalStartHour:number;normalEndHour:number;leakAllDay:boolean;cooldownSeconds:number};
type BudgetInfo={minimumBudget?:string;tariffName:string;estimate:{total:string}};
function monitoringDuration(seconds:number){if(seconds%3600===0)return seconds/3600+(seconds===3600?' hora':' horas');const minutes=Math.floor(seconds/60),rest=seconds%60;return minutes?minutes+' min'+(rest?' '+rest+' s':''):seconds+' s';}
type Alert={id:string;kind:string;details:{title:string;body:string};status:string;detected_at:string};
export function MonitoringPage({unitId,owner}:{unitId:string;owner:boolean}) {
 const [rules,setRules]=useState<Rules|null>(null),[alerts,setAlerts]=useState<Alert[]>([]),[goal,setGoal]=useState<Goal|null>(null),[budget,setBudget]=useState('50.00'),[error,setError]=useState(''),[queryError,setQueryError]=useState(''),[rulesError,setRulesError]=useState(''),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),initialBudget=useRef(false);
 const [budgetInfo,setBudgetInfo]=useState<BudgetInfo|null>(null),[budgetInfoError,setBudgetInfoError]=useState(''),[budgetInfoRevision,setBudgetInfoRevision]=useState(0);
 const minimumBudget=budgetInfo?.minimumBudget,budgetInvalid=!!budget.trim()&&!!minimumBudget&&Number(budget)<Number(minimumBudget);
 const hoursInvalid=!!rules?.leakEnabled&&!rules.leakAllDay&&rules.normalStartHour===rules.normalEndHour;
 useEffect(()=>{let live=true;setBudgetInfo(null);setBudgetInfoError('');api<BudgetInfo>('tariffs/estimate?unitId='+encodeURIComponent(unitId)+'&liters=0').then(value=>{if(live)setBudgetInfo(value);}).catch(e=>{if(live)setBudgetInfoError(messageOf(e));});return()=>{live=false;};},[unitId,budgetInfoRevision]);
 const refresh=useCallback(async()=>{
  try{const [a,g]=await Promise.all([api<Alert[]>('alerts?unitId='+unitId),api<Goal|null>('goals?unitId='+unitId)]);setAlerts(a);setGoal(g);setQueryError('');if(!initialBudget.current){if(g)setBudget(g.budget);initialBudget.current=true;}}
  catch(e){setQueryError(messageOf(e));throw e;}finally{setLoading(false);}
 },[unitId]);
 const loadRules=useCallback(async()=>{try{setRules(await api<Rules>('alerts/rules?unitId='+unitId));setRulesError('');}catch(e){setRulesError(messageOf(e));}},[unitId]);
 useEffect(()=>{setRules(null);setAlerts([]);setGoal(null);void loadRules();void refresh().catch(()=>{});const timer=setInterval(()=>{if(!document.hidden)void refresh().catch(()=>{});},10000);return()=>clearInterval(timer);},[unitId,refresh,loadRules]);
 async function work(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();await refresh();}catch(e){setError(messageOf(e));}finally{setBusy(false);}}
 async function validationDemo(){
  if(!rules)return;
  await api('simulation/'+unitId,'POST',{action:'pause'});
  const summary=await api<{monthLiters:number;monthEstimate:{total:string}}>('analytics/dashboard?unitId='+unitId);
  const preview=await api<{estimate:{total:string}}>('tariffs/estimate?unitId='+encodeURIComponent(unitId)+'&liters='+(summary.monthLiters+518));
  const current=Number(summary.monthEstimate.total),after=Number(preview.estimate.total);
  if(after<=current)throw new Error('La tarifa de esta unidad no aumenta con el consumo. Configura un precio por m³ para probar la meta.');
  const target=(Math.ceil((current+after)/2/0.8*100)/100).toFixed(2);
  const next={...rules,highEnabled:true,thresholdLiters:'100',windowSeconds:3600,leakEnabled:true,leakAllDay:true,leakWindowSeconds:30,cooldownSeconds:60};
  setRules(await api<Rules>('alerts/rules/'+unitId,'PUT',next));setBudget(target);
  setGoal(await api<Goal>('goals','POST',{unitId,budget:target}));
  await api('simulation/'+unitId,'POST',{action:'scenario',scenario:'demo'});
  setNotice('Prueba en curso: espera 30 segundos mientras se generan las lecturas de fuga. Puedes revisar los avisos desde la campanita.');
  await new Promise(resolve=>setTimeout(resolve,32000));
  const state=await api<{error:string}>('simulation/'+unitId);if(state.error)throw new Error(state.error);
  setNotice('Prueba completa: se generaron 518 L y flujo continuo para comprobar las alertas y el avance de la meta. Revisa la campanita. El correo usa tus preferencias y requiere Brevo configurado. Los avisos similares se separan por un minuto.');
 }
 function change(key:keyof Rules,value:string|number|boolean){setRules(old=>old?{...old,[key]:value}:old);}
 return <div className="feature-stack monitoring-page">
  <ErrorMessage value={error||queryError||rulesError}/>
  {rulesError&&<button className="button secondary" disabled={busy} onClick={()=>void loadRules()}>Reintentar reglas</button>}
  {notice&&<div className="message success" role="status">{notice}</div>}
  <details className="card monitoring-guide">
   <summary>Guía rápida: presupuesto y alertas</summary>
   <div className="monitoring-guide-steps">
    <div><h3>1. Decide tu presupuesto del mes</h3><p>Es el máximo que deseas gastar en agua en esta unidad. Se calcula con el consumo, desagüe, cargo fijo e impuestos de su tarifa. Es aparte del plan HydroSmart.</p><p>El aviso se genera al llegar al 80%. El presupuesto es personal y corresponde al mes actual en Lima.</p></div>
    <div><h3>2. Elige cuándo recibir alertas</h3><p>Consumo inusual suma los litros de todos los medidores de la unidad durante los últimos minutos que elijas. Posible fuga busca flujo continuo en un mismo medidor.</p><p>Un flujo de cero o una interrupción de lecturas reinicia la detección de fuga.</p></div>
    <div><h3>3. Elige dónde recibirlas</h3><p>El propietario configura las reglas de la unidad; cada cuenta decide si recibe avisos en la app y por correo. El inquilino recibe los correspondientes a su período de alquiler.</p><Link className="text-link" href="/notificaciones">Revisar mis notificaciones <Icon name="arrow"/></Link></div>
   </div>
  </details>
  <div className="two-columns monitoring-grid">
   <section className="card">
    <div className="card-heading"><div><h2>Mi presupuesto mensual de agua</h2><p>Tu límite personal para esta unidad · mes actual en Lima</p></div><Icon name="drop"/></div>
    <p className="muted small-text">Elige cuánto deseas gastar como máximo. El avance muestra el costo estimado del agua que ya consumiste.</p>
    {goal&&<div className="goal-progress"><strong>{money(goal.progress.cost)} <small>de {money(goal.budget)}</small></strong><progress aria-label="Presupuesto utilizado" max={100} value={Math.min(100,goal.progress.percent)}/><p>{liters(goal.progress.percent)}% utilizado · {liters(goal.progress.liters)} L</p><small>Equivale aproximadamente a {liters(Number(goal.targetLiters))} litros con la tarifa actual. El aviso del 80% respeta tus preferencias de notificación.</small></div>}
    <form className="stacked-form" onSubmit={e=>{e.preventDefault();if(budgetInvalid||busy)return;void work(async()=>{setGoal(await api<Goal>('goals','POST',{unitId,budget}));setNotice('Presupuesto mensual guardado.');});}}>
     <Field label="Mi presupuesto del mes (S/)" hint={minimumBudget?'Mínimo para esta tarifa: '+money(minimumBudget)+'.':'Se validará con la tarifa de esta unidad.'}><input type="number" min={minimumBudget||'.01'} max="1000000" step=".01" aria-invalid={budgetInvalid} value={budget} onChange={e=>{setBudget(e.target.value);setError('');}} required/></Field>
     {budgetInvalid&&<p className="monitoring-inline-error" role="alert">El presupuesto mínimo es {money(minimumBudget!)}. El cargo fijo y sus impuestos ya forman parte del costo del mes.</p>}
     {budgetInfo&&<div className="monitoring-explanation"><strong>Costo base mensual: {money(budgetInfo.estimate.total)}</strong><p>La tarifa incluye este cargo fijo con impuestos incluso antes de sumar consumo. Por eso el presupuesto necesita superar ese costo.</p><small>Tarifa: {budgetInfo.tariffName}</small></div>}
     {budgetInfoError&&<div className="monitoring-explanation"><p>No pudimos consultar el costo base. Al guardar, el servidor comprobará el presupuesto.</p><button type="button" className="text-link" disabled={busy} onClick={()=>setBudgetInfoRevision(n=>n+1)}>Reintentar tarifa</button></div>}
     <button className="button primary" disabled={busy||budgetInvalid}>Guardar presupuesto</button>
    </form>
   </section>
   <section className="card">
    <h2>Cuándo quieres que te avisemos</h2><p className="muted small-text">{owner?'Estas reglas se aplican a los medidores de esta unidad. Los cambios se aplican al guardar.':'El propietario configura estas reglas. Tu presupuesto mensual de agua sí es personal.'}</p>
    {rules&&<form className="stacked-form compact-form" onSubmit={e=>{e.preventDefault();if(busy||hoursInvalid)return;void work(async()=>{setRules(await api<Rules>('alerts/rules/'+unitId,'PUT',rules));setNotice('Reglas guardadas. Se aplican a las nuevas lecturas.');});}}>
     <fieldset disabled={!owner||busy}>
      <div className="monitoring-rule">
       <label className="check-label"><input type="checkbox" checked={rules.highEnabled} onChange={e=>change('highEnabled',e.target.checked)}/><strong>Alerta de consumo inusual</strong></label>
       <p className="muted small-text">Te avisa cuando se alcanza un volumen alto en poco tiempo, sumando todos los medidores de la unidad.</p>
       <div className="two-columns">
        <Field label="Avisarme al llegar a (litros)"><input type="number" min=".001" max="1000000" step=".001" value={rules.thresholdLiters} onChange={e=>change('thresholdLiters',e.target.value)} required disabled={!rules.highEnabled}/></Field>
        <Field label="Durante los últimos (minutos)"><input type="number" min="1" max="1440" step="any" value={rules.windowSeconds/60} onChange={e=>change('windowSeconds',Math.round(Number(e.target.value)*60))} required disabled={!rules.highEnabled}/></Field>
       </div>
       <p className="monitoring-preview">{rules.highEnabled?'Vista previa: te avisaremos al acumular '+liters(Number(rules.thresholdLiters))+' L o más en un período de '+monitoringDuration(rules.windowSeconds)+'.':'La alerta de consumo inusual está desactivada.'}</p>
      </div>
      <div className="monitoring-rule">
       <label className="check-label"><input type="checkbox" checked={rules.leakEnabled} onChange={e=>change('leakEnabled',e.target.checked)}/><strong>Alerta de posible fuga</strong></label>
       <p className="muted small-text">Busca agua corriendo sin pausas en un mismo medidor. Si el flujo se detiene o faltan lecturas, vuelve a contar.</p>
       <Field label="Si el agua corre sin parar durante (minutos)" hint="Por ejemplo: 3 minutos equivalen a 180 segundos de flujo continuo."><input type="number" min=".5" max="60" step="any" value={rules.leakWindowSeconds/60} onChange={e=>change('leakWindowSeconds',Math.round(Number(e.target.value)*60))} required disabled={!rules.leakEnabled}/></Field>
       <label className="check-label"><input type="checkbox" checked={rules.leakAllDay} onChange={e=>change('leakAllDay',e.target.checked)} disabled={!rules.leakEnabled}/>Vigilar fugas durante todo el día</label>
       {!rules.leakAllDay&&<div className="two-columns">
        <Field label="Tu uso habitual empieza a las"><select value={rules.normalStartHour} onChange={e=>change('normalStartHour',Number(e.target.value))} disabled={!rules.leakEnabled}>{Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{String(hour).padStart(2,'0')}:00</option>)}</select></Field>
        <Field label="Tu uso habitual termina a las"><select value={rules.normalEndHour} onChange={e=>change('normalEndHour',Number(e.target.value))} disabled={!rules.leakEnabled}>{Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{String(hour).padStart(2,'0')}:00</option>)}</select></Field>
       </div>}
       {hoursInvalid&&<p className="monitoring-inline-error" role="alert">Elige horas distintas para el inicio y el fin de tu uso habitual.</p>}
       <p className="monitoring-preview">{!rules.leakEnabled?'La alerta de posible fuga está desactivada.':'Vista previa: flujo continuo durante '+monitoringDuration(rules.leakWindowSeconds)+(rules.leakAllDay?' a cualquier hora.':' fuera de tu horario habitual de '+String(rules.normalStartHour).padStart(2,'0')+':00 a '+String(rules.normalEndHour).padStart(2,'0')+':00 (Lima).')}</p>
      </div>
      <details className="monitoring-advanced"><summary>Más opciones de avisos</summary><Field label="Esperar entre avisos similares (minutos)" hint="Evita repetir la misma clase de alerta de esta unidad para tu cuenta durante ese período."><input type="number" min="1" max="1440" step="any" value={rules.cooldownSeconds/60} onChange={e=>change('cooldownSeconds',Math.round(Number(e.target.value)*60))} required/></Field></details>
      {owner&&<button className="button primary" disabled={hoursInvalid}>Guardar reglas</button>}
     </fieldset>
    </form>}
   </section>
  </div>
 {owner&&<section className="card"><h2>Probar las alertas con tus medidores virtuales</h2><p className="muted small-text">La prueba completa pausa la generación, activa reglas de fuga las 24 horas y crea una meta cercana al 80%. Durante 30 segundos añade 518 litros al consumo de esta unidad para validar las dos alertas, la meta y los avisos por correo según tus preferencias.</p><button className="button primary" disabled={busy||!rules} onClick={()=>void work(validationDemo)}>Probar alertas, meta y correo</button><p className="muted small-text">Genera lecturas que se guardan como consumo. Para probar una fuga durante el día, guarda primero «24 horas» y una duración de 3 minutos. Pausa la generación en vivo desde Medidores para aislar la prueba.</p><div className="button-row">{[['high','Consumo alto · 500 L'],['leak','Fuga continua · 3 min'],['normal','Detener flujo · 0 L']].map(([scenario,label])=><button className="button secondary" key={scenario} disabled={busy} onClick={()=>void work(async()=>{await api('simulation/'+unitId,'POST',{action:'scenario',scenario});setNotice('Lecturas generadas. Las alertas llegarán en unos segundos.');})}>{label}</button>)}</div></section>}
 <section className="card"><div className="card-heading"><div><h2>Alertas de tu unidad</h2><p>Los avisos también aparecen en Notificaciones.</p></div><button className="text-link" onClick={()=>void work(refresh)}>Actualizar</button></div>{loading&&<p role="status">Consultando alertas…</p>}{!loading&&!queryError&&!alerts.length&&<p className="muted">No se detectaron alertas para tu cuenta.</p>}{alerts.map(a=><article className="feature-row" key={a.id}><div><strong>{a.details.title}</strong><p>{a.details.body}</p><small>{timestamp(a.detected_at)} · {a.status==='resolved'?'Resuelta':'Pendiente'}</small></div>{a.status!=='resolved'&&<button className="button secondary" disabled={busy} onClick={()=>void work(async()=>{await api('alerts/'+a.id+'/resolve?unitId='+unitId,'POST',{});})}>Marcar resuelta</button>}</article>)}</section></div>;
}

type Report={id:string;format?:'csv'|'pdf'|'xlsx';status:string;period_start:string;period_end:string;requested_at:string;last_error?:string|null;retryable?:boolean};
export function ReportJobs({unitId,from,to}:{unitId:string;from:string;to:string}){
 const [format,setFormat]=useState<'csv'|'pdf'|'xlsx'>('xlsx');
 const [items,setItems]=useState<Report[]>([]),[error,setError]=useState(''),[queryError,setQueryError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const request=useRef(0),lock=useRef(false);
 const refresh=useCallback(async()=>{
  const revision=++request.current;
  try{const values=await api<Report[]>('reports?unitId='+unitId);if(revision===request.current){setItems(values);setQueryError('');}}
  catch(e){if(revision===request.current)setQueryError(messageOf(e));throw e;}
  finally{if(revision===request.current)setLoading(false);}
 },[unitId]);
 useEffect(()=>{void refresh().catch(()=>{});const timer=setInterval(()=>{if(!document.hidden)void refresh().catch(()=>{});},10000);return()=>{request.current++;clearInterval(timer);};},[refresh]);
 async function work(fn:()=>Promise<void>){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await fn();await refresh();}catch(e){setError(messageOf(e));}finally{lock.current=false;setBusy(false);}
 }
 return <section className="card table-card">
  <div className="card-heading"><div><h2>Mis reportes</h2><p>Consumo diario y costo estimado. Excel y PDF con diseño; CSV para datos simples.</p></div><div className="report-actions"><Field label="Formato del reporte"><select value={format} disabled={busy} onChange={e=>setFormat(e.target.value as 'csv'|'pdf'|'xlsx')}><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF</option><option value="csv">CSV (datos sin formato)</option></select></Field><button className="button secondary" disabled={busy} onClick={()=>void work(async()=>{await api('reports','POST',{unitId,format,from:from+'T00:00:00-05:00',to:new Date(new Date(to+'T00:00:00-05:00').getTime()+86400000).toISOString()});})}>Preparar reporte {format==='xlsx'?'Excel':format.toUpperCase()}</button></div></div>
  <ErrorMessage value={error||queryError}/>
  {queryError&&<button className="button secondary" disabled={busy} onClick={()=>void refresh().catch(()=>{})}>Reintentar consulta de reportes</button>}
  {loading&&!items.length?<p role="status">Consultando reportes…</p>:!items.length&&!queryError?<p className="muted">Todavía no has solicitado reportes.</p>:null}
  {items.map(r=><article className="feature-row" key={r.id}><div><strong>Reporte de consumo · {r.format==='xlsx'?'Excel':(r.format||'csv').toUpperCase()}</strong><small>{timestamp(r.period_start)} — {timestamp(r.period_end)} · {statusLabel[r.status]||r.status}</small>{r.last_error&&<p className="small-text">{r.last_error}</p>}</div><div className="button-row">{r.status==='completed'&&<button className="button secondary" disabled={busy} onClick={()=>void work(()=>apiDownload('reports/'+r.id+'/download','hydrosmart-'+r.id+'.'+(r.format||'csv')))}>Descargar {r.format==='xlsx'?'Excel':(r.format||'csv').toUpperCase()}</button>}{(r.retryable||r.status==='failed')&&<button className="button secondary" disabled={busy} onClick={()=>void work(async()=>{await api('reports/'+r.id+'/retry','POST',{});})}>Reintentar reporte</button>}</div></article>)}
 </section>;
}
