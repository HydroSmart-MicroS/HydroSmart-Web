import type { Metadata } from 'next';
import './globals.css';
import './flows.css';
export const metadata: Metadata = {title:'HydroSmart · Tu agua, en claro',description:'Consumo de agua, costos estimados y medidores virtuales en un solo lugar.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="es"><body>{children}</body></html>;
}

