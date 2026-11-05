import Link from 'next/link';
import {ROUTES} from '@/lib/routes';

export default function SiteFooter() {
  return (
    <footer className='site-footer'>
      <div className='page site-footer-inner'>
        <Link href={ROUTES.home} className='wordmark'>
          Marketplace
        </Link>
        <nav aria-label='Footer'>
          <Link href={ROUTES.search}>Browse listings</Link>
          <Link href={ROUTES.sell}>Sell an item</Link>
        </nav>
      </div>
    </footer>
  );
}
