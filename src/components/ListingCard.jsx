import Link from 'next/link';
import {ROUTES} from '@/lib/routes';
import {formatDuration, formatLabel, formatPrice} from '@/lib/format';
import styles from './ListingCard.module.css';

function auctionState(listing, now) {
  if (listing.saleType !== 'auction') return null;
  if (listing.startsAt && new Date(listing.startsAt) > now) {
    return {text: `Starts in ${formatDuration(listing.startsAt, now)}`, at: listing.startsAt, urgent: false};
  }
  const left = formatDuration(listing.endsAt, now);
  if (!left) return {text: 'Ended', at: listing.endsAt, urgent: false};
  const urgent = new Date(listing.endsAt).getTime() - now.getTime() < 60 * 60 * 1000;
  return {text: `Ends in ${left}`, at: listing.endsAt, urgent};
}

export default function ListingCard({listing, now = new Date(), priority = false}) {
  const auction = auctionState(listing, now);
  const hasBid = auction && listing.currentBid != null;
  const amount = hasBid ? listing.currentBid : listing.price;
  const image = listing.photo?.card || listing.photo?.thumb;
  const meta = [formatLabel(listing.condition), listing.zip].filter(Boolean);

  return (
    <article className={styles.card}>
      <Link href={ROUTES.listing(listing.id)} className={styles.link}>
        <div className={styles.media}>
          {image ? (
            <img
              src={image}
              alt={listing.title}
              width={480}
              height={360}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              decoding='async'
            />
          ) : (
            <span className={styles.noPhoto}>No photo</span>
          )}
          {auction && (
            <span className={auction.urgent ? `${styles.badge} ${styles.urgent}` : styles.badge}>
              <span className={styles.badgeType}>Auction</span>
              <time dateTime={new Date(auction.at).toISOString()}>{auction.text}</time>
            </span>
          )}
        </div>
        <div className={styles.body}>
          <p className={styles.priceRow}>
            <span className={styles.price}>{formatPrice(amount)}</span>
            {auction && <span className={styles.priceNote}>{hasBid ? 'Current bid' : 'Starting bid'}</span>}
          </p>
          <h3 className={styles.title}>{listing.title}</h3>
          {meta.length > 0 && <p className={styles.meta}>{meta.join(' · ')}</p>}
        </div>
      </Link>
    </article>
  );
}
