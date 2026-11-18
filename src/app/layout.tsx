import type { Metadata } from 'next';
import './globals.css';
import './flows.css';
export const metadata: Metadata = {title:'HydroSmart · Tu agua, en claro',icons:{icon:{url:'/app/favicon.svg?v=20261117',type:'image/svg+xml'}},description:'Consumo de agua, costos estimados y medidores virtuales en un solo lugar.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="es-PE"><body>{children}</body></html>;
}

