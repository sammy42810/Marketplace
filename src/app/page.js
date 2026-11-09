import Link from 'next/link';
import ListingCard from '@/components/ListingCard';
import {ROUTES} from '@/lib/routes';
import {formatLabel} from '@/lib/format';
import {getActiveCategories, getAuctionsEndingSoon, getNewestListings} from '@/lib/server/listings';
import styles from './home.module.css';

export const dynamic = 'force-dynamic';

async function loadFeed() {
  try {
    const [newest, endingSoon, categories] = await Promise.all([
      getNewestListings(24),
      getAuctionsEndingSoon(4),
      getActiveCategories(12)
    ]);
    return {newest, endingSoon, categories, failed: false};
  } catch (error) {
    console.error('Home feed failed to load:', error.message);
    return {newest: [], endingSoon: [], categories: [], failed: true};
  }
}

function SectionHead({id, title, href, linkText}) {
  return (
    <div className={styles.sectionHead}>
      <h2 id={id}>{title}</h2>
      {href && (
        <Link href={href} className={styles.sectionLink}>
          {linkText}
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const {newest, endingSoon, categories, failed} = await loadFeed();
  const now = new Date();

  return (
    <>
      <div className={styles.intro}>
        <h1>Marketplace</h1>
        <p>Buy, sell, trade and auction used items near you.</p>
      </div>

      {failed && (
        <div className={styles.notice} role='alert'>
          <p>Listings couldn&apos;t load right now.</p>
          <a href={ROUTES.home} className='btn btn-quiet'>
            Try again
          </a>
        </div>
      )}

      {!failed && newest.length === 0 && (
        <div className={styles.notice}>
          <p>No listings yet.</p>
          <Link href={ROUTES.sell} className='btn btn-primary'>
            Sell an item
          </Link>
        </div>
      )}

      {categories.length > 0 && (
        <section aria-labelledby='home-categories' className={styles.section}>
          <SectionHead id='home-categories' title='Browse by category' />
          <ul className={styles.categories}>
            {categories.map(({category, count}) => (
              <li key={category}>
                <Link href={ROUTES.category(category)} className={styles.category}>
                  <span>{formatLabel(category)}</span>
                  <span className={styles.count}>
                    {count}
                    <span className='sr-only'> listings</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {endingSoon.length > 0 && (
        <section aria-labelledby='home-ending' className={styles.section}>
          <SectionHead
            id='home-ending'
            title='Auctions ending soon'
            href={`${ROUTES.search}?saleType=auction&sort=ending`}
            linkText='All auctions'
          />
          <ul className={`${styles.grid} ${styles.gridFour}`}>
            {endingSoon.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} now={now} priority={index < 4} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {newest.length > 0 && (
        <section aria-labelledby='home-newest' className={styles.section}>
          <SectionHead id='home-newest' title='Newest listings' href={ROUTES.search} linkText='Browse all' />
          <ul className={styles.grid}>
            {newest.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} now={now} priority={endingSoon.length === 0 && index < 4} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
