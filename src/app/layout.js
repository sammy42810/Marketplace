import {connection} from 'next/server';
import {AuthProvider} from '@/context/AuthContext';
import {NotificationsProvider} from '@/context/NotificationsContext';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';

export const metadata = {
  title: {default: 'Marketplace', template: '%s | Marketplace'},
  description: 'Buy, sell, trade and auction used items locally.'
};

export default async function RootLayout({children}) {
  // Render every page per request. server.js sends a new CSP nonce each time, and a page
  // prerendered at build time wouldn't carry it, so the browser would block its scripts.
  await connection();

  return (
    <html lang='en'>
      <body>
        <AuthProvider>
          <NotificationsProvider>
            <SiteHeader />
            <main className='site-main'>{children}</main>
            <SiteFooter />
          </NotificationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
