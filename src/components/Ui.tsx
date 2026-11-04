'use client';
import {cloneElement,useEffect,useId,useRef,type ReactElement,type ReactNode} from 'react';
const paths:Record<string,string>={bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',grid:'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z',chart:'M3 3v18h18 M7 14l4-5 4 3 5-7',home:'M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-7h6v7',meter:'M4 16a9 9 0 1 1 16 0 M12 12l4-4 M8 20h8',receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',drop:'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13z M8 16c0 2 1 3 3 3',arrow:'M5 12h14 M13 6l6 6-6 6',logout:'M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4',shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',plus:'M12 5v14 M5 12h14',menu:'M4 6h16 M4 12h16 M4 18h16'};
export function Icon({name,className=''}:{name:string;className?:string}) {return <svg className={'icon '+className} width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.drop}/></svg>;}
export function Brand() {return <span className="brand"><span className="brand-mark"><Icon name="drop"/></span><span>hydrosmart<span className="brand-period">.</span></span></span>;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) {
  const id=useId();
  const child=children as ReactElement<{id?:string;'aria-describedby'?:string;type?:string;minLength?:number;maxLength?:number;pattern?:string}>;
  const text=child.type==='input'&&(!child.props.type||child.props.type==='text'),email=child.type==='input'&&child.props.type==='email';
  const maximum=child.props.maxLength??(email?254:120),minimum=child.props.minLength??1;
  const help=hint||(text?`${minimum} a ${maximum} caracteres. No uses solo espacios.`:undefined);
  const control=cloneElement(child,{...(text||email?{maxLength:maximum,minLength:minimum}:{}),...(text?{pattern:child.props.pattern??'[^\\x00-\\x1F\\x7F]*\\S[^\\x00-\\x1F\\x7F]*'}:{}),id,'aria-describedby':help?id+'-hint':undefined});
  return <div className="field"><label htmlFor={id}>{label}</label>{control}{help&&<small id={id+'-hint'}>{help}</small>}</div>;
}
export function Modal({title,children,onClose,busy=false,error=''}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean;error?:string}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{const node=dialog.current;if(node&&!node.open)node.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{node?.close();document.body.style.overflow=previous;};},[]);
 return <dialog ref={dialog} className="form-modal" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target!==e.currentTarget||busy)return;const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();}}><header className="modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}>×</button></header><div className="modal-content">{error&&<div className="message error" role="alert">{error}</div>}{children}</div></dialog>;
}
