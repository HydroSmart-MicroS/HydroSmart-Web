export type User = {id:string;name:string;email:string;image?:string|null;profileType:'propietario'|'inquilino'};
export type Unit = {id:string;propertyId:string;name:string};
export type Property = {id:string;name:string;address:string};
export type Device = {id:string;unitId:string;name:string;serialNumber:string;category:string;state:'registered'|'active'|'disabled'};
export type Tenancy = {id:string;tenantUserId:string;startsAt:string;endsAt:string|null};
export type Daily = {date:string;deviceId:string;liters:number;readingCount:number};
export type Estimate = {water:string;sewer:string;fixedCharge:string;subtotal?:string;tax?:string;taxRate?:string|null;total:string;m3:string;breakdown:{fromM3:string;toM3:string|null;volumeM3:string;water:string;sewer:string}[]};
export type PeriodComparison = {available:boolean;days:number;currentStart:string;currentEnd:string|null;previousStart:string;previousEnd:string|null;currentLiters:number|null;previousLiters:number|null;changePercent:number|null;reason:string};
export type Recommendation = {code:string;title:string;body:string;path:string;deviceId?:string};
export type Goal = {id:string;month:string;budget:string;targetLiters:string;progress:{cost:string;liters:number;percent:number}};
export type Dashboard = {liters:number;readingCount:number;firstReadingAt:string|null;lastReadingAt:string|null;available:boolean;daily:Daily[];
  devices:{deviceId:string;liters:number;lastReadingAt:string}[];estimate:Estimate;monthEstimate:Estimate;monthLiters:number;todayLiters:number;
  projection:null|{liters:number;cost:string};comparison:null|{currentLiters:number;previousLiters:number;changePercent:number};tariffName:string;
  comparisons?:{weekly:PeriodComparison;monthly:PeriodComparison};recommendations?:Recommendation[]};
export type Simulation = {running:boolean;seeding:boolean;completed:number;total:number;error:string};
export type Tariff = {id?:string;effectiveFrom?:string|null;name:string;category:'domestic'|'commercial';fixedCharge:string;taxRate?:string;sourceUrl?:string|null;sourceDate?:string|null;isReference?:boolean;currency?:string;
  tiers:{fromM3:string;toM3:string|null;waterPrice:string;sewerPrice:string}[]};
export const liters=(n:number)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:1}).format(n);
export const money=(n:number|string)=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(n));
export const localDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const daysAgo=(n:number)=>localDate(new Date(Date.now()-n*86400000));
export const timestamp=(value:string|null)=>value?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Sin lecturas';
export function monthLabel(value:string|null) {
  const month=value?.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/);
  return month?new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',year:'numeric',month:'long'}).format(new Date(month[1]+'-'+month[2]+'-01T12:00:00Z')):value||'Mes sin fecha';
}
export function download(text:string,name:string,type='text/csv;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

