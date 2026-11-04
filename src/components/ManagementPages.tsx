'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {api,messageOf} from '../lib/api';
import type {Device,Property,Tenancy,Unit,User} from '../lib/types';
import {liters,timestamp} from '../lib/types';
import type {Dashboard} from '../lib/types';
import {Field,Icon,Modal} from './Ui';

type Work=(task:()=>Promise<void>)=>Promise<void>;
export function UnitManagement({user,units,properties,unitId,busy,refresh,onChoose,onReload,work,notify,error}:{user:User;units:Unit[];properties:Property[];unitId:string;busy:boolean;refresh:number;onChoose:(id:string)=>void;onReload:()=>Promise<void>;work:Work;notify:(text:string)=>void;error?:string}){
 const owner=user.profileType==='propietario';
 const [creating,setCreating]=useState(false),[propertyId,setPropertyId]=useState(properties[0]?.id||'new');
 const [tenancies,setTenancies]=useState<Tenancy[]>([]),[rentalError,setRentalError]=useState(''),[rentalLoading,setRentalLoading]=useState(false);
 const [assigning,setAssigning]=useState(false);
 const [editingUnit,setEditingUnit]=useState<Unit|null>(null),[createdUnit,setCreatedUnit]=useState<Unit|null>(null);
 const selected=units.find(u=>u.id===unitId),tenant=tenancies.find(t=>!t.endsAt);
 useEffect(()=>{if(!owner||!unitId)return;let live=true;setTenancies([]);setRentalError('');setRentalLoading(true);api<Tenancy[]>('tenancies?unitId='+unitId).then(rows=>{if(live)setTenancies(rows);}).catch(e=>{if(live)setRentalError(messageOf(e));}).finally(()=>{if(live)setRentalLoading(false);});return()=>{live=false;};},[owner,unitId,refresh]);
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=new FormData(e.currentTarget);
  await work(async()=>{
   let target=propertyId;
   if(target==='new'){
    const property=await api<Property>('properties','POST',{name:String(form.get('propertyName')).trim(),address:String(form.get('address')).trim()});
    target=property.id;setPropertyId(target);await onReload();
   }
   const unit=await api<Unit>('units','POST',{propertyId:target,name:String(form.get('unitName')).trim()});
   await onReload();onChoose(unit.id);setCreatedUnit(unit);setCreating(false);notify('Unidad creada. Puedes añadir su primer medidor.');
  });
 }
 return <div className="feature-stack"><div className="section-toolbar"><p className="muted">Una unidad es el espacio cuyo consumo quieres medir: una vivienda, un departamento o un área verde. El propietario administra los espacios y puede asignarlos a un inquilino.</p>{owner&&<button className="button primary" disabled={busy} onClick={()=>setCreating(true)}>Nueva unidad<Icon name="plus"/></button>}</div>
 {editingUnit&&owner&&<Modal title="Editar unidad" onClose={()=>setEditingUnit(null)} busy={busy} error={error}><form className="stacked-form" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void work(async()=>{await api('units/'+editingUnit.id,'PUT',{name:String(form.get('unitName')).trim()});await onReload();setEditingUnit(null);notify('Nombre de la unidad actualizado.');});}}><Field label="Nombre de la unidad"><input name="unitName" defaultValue={editingUnit.name} required maxLength={80} disabled={busy}/></Field><div className="button-row"><button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar unidad'}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>setEditingUnit(null)}>Cancelar</button></div></form></Modal>}
 {creating&&owner&&<Modal title="Crear unidad" onClose={()=>setCreating(false)} busy={busy} error={error}><p className="muted small-text">Agrúpala en una propiedad y dale un nombre fácil de reconocer.</p><form className="stacked-form" onSubmit={create}>
 <Field label="Propiedad"><select value={propertyId} onChange={e=>setPropertyId(e.target.value)}>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="new">Crear una propiedad nueva</option></select></Field>
 {propertyId==='new'&&<div className="two-columns"><Field label="Nombre de la propiedad"><input name="propertyName" placeholder="Ej. Casa de Surco" maxLength={120} required/></Field><Field label="Dirección"><input name="address" placeholder="Ej. Av. Caminos del Inca 123" maxLength={500} required/></Field></div>}
 <Field label="Nombre de la unidad"><input name="unitName" placeholder="Ej. Departamento 101 o Casa completa" maxLength={80} required/></Field><div className="button-row"><button className="button primary" disabled={busy}>{busy?'Guardando…':'Crear unidad'}</button><button className="button secondary" type="button" disabled={busy} onClick={()=>setCreating(false)}>Cancelar</button></div></form></Modal>}
 <section className="card"><div className="card-heading"><h2>{owner?'Mis unidades':'Mis unidades asignadas'}</h2><span className="count-badge">{units.length}</span></div><div className="units-list">{units.map(u=><div className="unit-item-row" key={u.id}><button className={'unit-row '+(unitId===u.id?'selected':'')} aria-pressed={unitId===u.id} onClick={()=>onChoose(u.id)}><span className="unit-row-icon"><Icon name="home"/></span><span><strong>{u.name}</strong><small>{properties.find(p=>p.id===u.propertyId)?.name||'Unidad asignada'}</small></span>{unitId===u.id?<span className="badge">Seleccionada</span>:<Icon name="arrow"/>}</button>{owner&&<button className="button subtle" disabled={busy} aria-label={'Editar '+u.name} onClick={()=>setEditingUnit(u)}>Editar</button>}</div>)}</div>{!units.length&&<p className="muted">{owner?'Pulsa Nueva unidad para registrar tu primer espacio.':'Comparte tu código de Mi perfil con el propietario para que te asigne una unidad.'}</p>}
 {selected&&<div className="unit-next"><strong>{selected.name}</strong><div className="button-row"><Link className="button primary" href="/">Ver consumo</Link><Link className="button secondary" href="/dispositivos">{owner?'Gestionar medidores':'Ver medidores'}</Link><Link className="text-link" href="/tarifas">Ver tarifa <Icon name="arrow"/></Link></div></div>}{!owner&&<Link href="/perfil" className="text-link">Ver mi código de usuario <Icon name="arrow"/></Link>}</section>
 {owner&&createdUnit&&createdUnit.id===unitId&&<section className="callout"><span><strong>{selected?.name||createdUnit.name} está lista</strong><small>Añade su primer medidor para registrar consumo.</small></span><Link className="button primary" href="/dispositivos?crear=1" onClick={()=>onChoose(createdUnit.id)}>Añadir primer medidor <Icon name="arrow"/></Link></section>}
 {owner&&selected&&<details className="card rental-details" key={unitId}><summary>Alquiler de {selected.name} <span className="muted small-text">Opcional · asignar o retirar acceso a un inquilino</span></summary><p className="small-text muted">El inquilino verá el consumo desde el inicio de su alquiler. Necesita su propia cuenta y un plan activo.</p>{rentalError?<p className="message error" role="alert">{rentalError}</p>:rentalLoading?<p role="status">Consultando alquiler…</p>:tenant?<div className="tenancy-active"><span><strong>Inquilino asignado</strong><code>{tenant.tenantUserId}</code><small>Desde {timestamp(tenant.startsAt)}</small></span><button className="button secondary" disabled={busy} onClick={()=>{if(window.confirm('¿Finalizar el alquiler? El inquilino perderá acceso a esta unidad. El historial se conserva.'))void work(async()=>{await api('tenancies/'+tenant.id,'DELETE');notify('Alquiler finalizado.');});}}>Finalizar alquiler</button></div>:<><button className="button primary" disabled={busy} onClick={()=>setAssigning(true)}>Asignar inquilino</button>{assigning&&<Modal title={"Asignar inquilino a "+selected.name} onClose={()=>setAssigning(false)} busy={busy} error={error}><form className="stacked-form" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void work(async()=>{await api('tenancies','POST',{unitId,tenantUserId:String(form.get('tenantId')).trim()});setAssigning(false);notify('Inquilino asignado a esta unidad.');});}}><Field label="Código del inquilino" hint="El inquilino lo copia desde Mi perfil."><input name="tenantId" maxLength={255} required placeholder="Pega aquí su código"/></Field><button className="button primary" disabled={busy}>Asignar inquilino</button></form></Modal>}</>}</details>}</div>;
}

export function MeterManagement({devices,inventoryAvailable,loading,data,unitId,unitName,owner,busy,capacity,onReload,work,notify,error}:{devices:Device[];inventoryAvailable:boolean;loading:boolean;data:Dashboard|null;unitId:string;unitName:string;owner:boolean;busy:boolean;capacity:{count:number;limit:number}|null;onReload:()=>Promise<void>;work:Work;notify:(text:string)=>void;error?:string}){
 const [formOpen,setFormOpen]=useState(false),[editing,setEditing]=useState<Device|null>(null),[pending,setPending]=useState<Device|null>(null);
 const serial=useRef<string|null>(null);
 useEffect(()=>{
  setEditing(null);setPending(null);serial.current=null;
  const url=new URL(window.location.href),create=owner&&url.searchParams.get('crear')==='1';
  setFormOpen(create);
  if(create){url.searchParams.delete('crear');window.history.replaceState(window.history.state,'',url.toString());}
 },[unitId,owner]);
 const full=capacity?capacity.count>=capacity.limit:true;
 function close(){setFormOpen(false);setEditing(null);setPending(null);serial.current=null;}
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=new FormData(e.currentTarget);
  await work(async()=>{
   const body={name:String(form.get('name')).trim(),category:String(form.get('category')).trim()};
   let registered=pending;
   try{
    if(editing)await api('devices/'+editing.id,'PUT',{...body,state:editing.state});
    else{
     if(!registered){
      serial.current ||= 'VIRTUAL-'+crypto.randomUUID();
      try{registered=await api<Device>('devices','POST',{...body,unitId,serialNumber:serial.current});}
      catch(createError){
       const existing=await api<Device[]>('devices?unitId='+unitId).catch(()=>[]);
       registered=existing.find(device=>device.serialNumber===serial.current)||null;
       if(!registered)throw createError;
      }
      setPending(registered);
     }
     await api('devices/'+registered.id,'PUT',{...body,state:'active'});
    }
    await onReload();close();notify(editing?'Nombre y ubicación actualizados.':'Medidor añadido. Ya puedes iniciar la generación de lecturas.');
   }catch(failure){
    if(registered&&!editing)await onReload().catch(()=>{});
    throw failure;
   }
  });
 }
 return <div className="feature-stack">
  <section className="card"><div className="card-heading"><div><h2>Medidores de {unitName}</h2><p>Un medidor registra el agua de un punto de consumo de esta unidad.</p></div>{owner&&<button className="button primary" disabled={busy||full} onClick={()=>{setEditing(null);setPending(null);serial.current=null;setFormOpen(true);}}>Añadir medidor <Icon name="plus"/></button>}</div>
   {owner&&<p className="capacity-line">{capacity?capacity.count+' de '+capacity.limit+' medidores usados en tu cuenta.':'Consultando capacidad del plan…'} {full&&capacity&&'Has alcanzado el límite.'} <Link className="text-link" href="/pagos">Ver mi plan</Link></p>}
   {!inventoryAvailable&&<p className="empty-small muted" role="status">{loading?'Consultando medidores…':'No se pudo consultar la lista de medidores. Reintenta la consulta.'}</p>}
   {inventoryAvailable&&!devices.length&&<p className="empty-small muted">Todavía no hay medidores. {owner?'Añade uno para comenzar a registrar consumo.':'El propietario debe añadir y activar los medidores.'}</p>}
   <div className="devices-list">{devices.map(device=>{
    const usage=data?.devices.find(d=>d.deviceId===device.id);
    return <article className="device-item" key={device.id}><div className="device-item-top"><span className="device-icon"><Icon name="meter"/></span><span className="device-title"><h3>{device.name}</h3><span>{device.category}</span></span><span className={'status-badge '+device.state}>{device.state==='active'?'Activo':device.state==='disabled'?'Desactivado':'Pendiente de activar'}</span></div>
     <div className="device-stats"><div><small>CONSUMO · ÚLTIMOS 31 DÍAS</small><strong>{data?liters(usage?.liters||0):'—'} <span>L</span></strong></div><div><small>ÚLTIMA LECTURA</small><strong className="last-reading">{data?timestamp(usage?.lastReadingAt||null):'No disponible'}</strong></div></div>
     {owner&&<div className="button-row"><button className="button secondary" disabled={busy} onClick={()=>{setPending(null);setEditing(device);setFormOpen(true);}}>Editar nombre</button><button className="button secondary" disabled={busy||(device.state==='disabled'&&full)} onClick={()=>{if(device.state==='active'&&!window.confirm('¿Desactivar este medidor? Dejará de generar lecturas y conservará su historial.'))return;void work(async()=>{await api('devices/'+device.id,'PUT',{name:device.name,category:device.category,state:device.state==='active'?'disabled':'active'});await onReload();notify(device.state==='active'?'Medidor desactivado. Su historial se conserva.':'Medidor activado.');});}}>{device.state==='active'?'Desactivar':'Activar'}</button></div>}
     <details className="meter-technical"><summary>Identificador del medidor</summary><code>{device.serialNumber}</code></details></article>;
   })}</div>
  </section>
  {owner&&formOpen&&<Modal title={editing?'Editar medidor':'Añadir medidor virtual'} key={editing?.id||unitId} onClose={close} busy={busy} error={error}>
   <p className="small-text muted">{unitName} · el identificador se crea automáticamente.</p>
   {pending&&<p className="message" role="status">El medidor ya está registrado. Reintenta la activación sin crear otro.</p>}
   {!editing&&!pending&&full&&<p className="message" role="status">{capacity?'Tu plan no tiene plazas disponibles. Revisa la capacidad en Plan y pagos.':'No pudimos consultar la capacidad. Reintenta desde Plan y pagos.'}</p>}
   <form className="stacked-form" onSubmit={save}>
    <Field label="Nombre del medidor"><input name="name" required maxLength={120} disabled={busy} defaultValue={editing?.name||''} placeholder="Ej. Medidor del departamento"/></Field>
    <Field label="Ubicación"><input name="category" required maxLength={80} disabled={busy} defaultValue={editing?.category||'General'} placeholder="Ej. Baño, cocina o general"/></Field>
    <div className="button-row"><button className="button primary" disabled={busy||(!editing&&!pending&&full)}>{busy?'Guardando…':editing?'Guardar cambios':pending?'Reintentar activación':'Crear y activar medidor'}</button><button className="button secondary" type="button" onClick={close} disabled={busy}>Cancelar</button></div>
   </form>
  </Modal>}
 </div>;
}
