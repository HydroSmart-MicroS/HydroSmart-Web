'use client';
import {DeleteAccount} from './DeleteAccount';
import Link from 'next/link';
import {download,type User} from '../lib/types';
import {accountExport} from '../lib/account-export';
import {Icon} from './Ui';
export function SettingsPage({user,active}:{user:User;active:boolean}){
 return <div className="feature-stack"><p className="muted">Administra tu cuenta, el uso de tus datos y cómo recibes los avisos.</p><div className="settings-grid">
 <section className="card"><Icon name="user"/><h2>Mi cuenta y seguridad</h2><p>Actualiza tu nombre, foto y contraseña desde tu perfil.</p><Link className="button secondary" href="/perfil">Editar mi perfil</Link></section>
 <section className="card"><Icon name="bell"/><h2>Notificaciones</h2><p>Elige los avisos de consumo, fugas y metas que quieres recibir en la aplicación y por correo.</p><Link className="button secondary" href={active?'/notificaciones':'/pagos'}>{active?'Configurar notificaciones':'Activar un plan'}</Link></section>
 <section className="card"><Icon name="receipt"/><h2>Mis datos</h2><p>Descarga una copia de tus datos de perfil en JSON. El consumo por unidad se exporta por separado desde Historial.</p><div className="button-row"><button className="button secondary" onClick={()=>download(JSON.stringify(accountExport(user),null,2),'mis-datos-hydrosmart.json','application/json')}>Descargar datos de mi cuenta</button>{active&&<Link className="text-link" href="/historial">Exportar consumo <Icon name="arrow"/></Link>}</div></section>
 <section className="card"><Icon name="shield"/><h2>Privacidad y control</h2><p>Consulta qué datos guardamos y quién puede verlos. El propietario puede pausar las lecturas y desactivar un medidor conservando su historial.</p><div className="button-row"><Link className="button secondary" href="/privacidad">Consultar privacidad</Link>{active&&<Link className="text-link" href="/dispositivos">Ver medidores <Icon name="arrow"/></Link>}</div><p className="small-text muted">Puedes solicitar el borrado desde aquí. Primero resuelve tus asignaciones activas y pagos pendientes.</p><DeleteAccount/></section>
 </div></div>;
}
