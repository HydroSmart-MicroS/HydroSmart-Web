'use client';

import Script from 'next/script';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

type Turnstile = {
  render: (target: HTMLElement, options: {
    sitekey: string;
    action: string;
    size: 'flexible' | 'compact';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
    'response-field': false;
  }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

type Props = {
  siteKey: string;
  onToken: (token: string) => void;
  ref: Ref<() => void>;
};

export function RegistrationChallenge({siteKey,onToken,ref}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const [ready,setReady] = useState(false);
  const [failed,setFailed] = useState(false);
  useImperativeHandle(ref, () => () => reset.current(), []);

  useEffect(() => {
    if (!ready || !container.current) return;
    const widget = (window as Window & {turnstile?: Turnstile}).turnstile;
    if (!widget) {
      setFailed(true);
      return;
    }
    let id: string;
    try {
      id = widget.render(container.current, {
        sitekey: siteKey,
        action: 'sign_up',
        size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
        callback: token => { setFailed(false); onToken(token); },
        'expired-callback': () => onToken(''),
        'error-callback': () => { setFailed(true); onToken(''); },
        'response-field': false,
      });
    } catch {
      setFailed(true);
      return;
    }
    reset.current = () => { onToken(''); widget.reset(id); };
    return () => {
      reset.current = () => {};
      widget.remove(id);
    };
  }, [ready,siteKey,onToken]);

  return <div aria-label="Verificación de seguridad">
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      onReady={() => setReady(true)} onError={() => setFailed(true)} />
    <div ref={container}/>
    {failed && <p className="small-text muted" role="status">No pudimos cargar la verificación. Actualiza la página para volver a intentarlo.</p>}
  </div>;
}
