import {AuthProvider} from '@/context/AuthContext';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';

export const metadata = {
  title: {default: 'Marketplace', template: '%s | Marketplace'},
  description: 'Buy, sell, trade and auction used items locally.'
};

export default function RootLayout({children}) {
  return (
    <html lang='en'>
      <body>
        <AuthProvider>
          <SiteHeader />
          <main className='site-main'>{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
