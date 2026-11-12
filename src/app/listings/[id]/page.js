import {cache} from 'react';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {HttpError} from '@/lib/server/auth';
import {getListing, getSellerRating} from '@/lib/server/listings';
import {ROUTES} from '@/lib/routes';
import {formatDuration, formatLabel, formatPrice} from '@/lib/format';
import Gallery from './Gallery';
import OfferPanel from './OfferPanel';
import styles from './listing.module.css';

export const dynamic = 'force-dynamic';

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
  timeZoneName: 'short'
});
const dateOnly = new Intl.DateTimeFormat('en-US', {dateStyle: 'medium', timeZone: 'America/New_York'});

const loadListing = cache(async (id) => {
  try {
    return {listing: await getListing(id), failed: false};
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    console.error('Listing failed to load:', error.message);
    return {listing: null, failed: true};
  }
});

export async function generateMetadata({params}) {
  const {id} = await params;
  const {listing} = await loadListing(id);
  return listing ? {title: listing.title, description: listing.description?.slice(0, 160)} : {title: 'Listing'};
}

function saleState(listing, now) {
  if (listing.status === 'sold') return 'sold';
  if (listing.saleType !== 'auction') return 'offer';
  if (listing.startsAt && new Date(listing.startsAt) > now) return 'upcoming';
  if (!listing.endsAt || new Date(listing.endsAt) <= now) return 'ended';
  return 'live';
}

function SellerCard({seller, rating}) {
  if (!seller) {
    return (
      <div className={styles.seller}>
        <span className={styles.avatar} aria-hidden='true'>?</span>
        <div>
          <p className={styles.sellerName}>Unknown seller</p>
        </div>
      </div>
    );
  }

  const name = seller.displayName || 'Seller';
  return (
    <div className={styles.seller}>
      {seller.photoUrl ? (
        <img className={styles.avatar} src={seller.photoUrl} alt='' width={48} height={48} referrerPolicy='no-referrer' />
      ) : (
        <span className={styles.avatar} aria-hidden='true'>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <div>
        <p className={styles.sellerLabel}>Sold by</p>
        <Link href={ROUTES.profile(seller._id)} className={styles.sellerName}>
          {name}
        </Link>
        <p className={styles.rating}>
          {rating.count > 0 ? (
            <>
              <span className={styles.stars} aria-hidden='true'>
                ★
              </span>
              <strong>{rating.average.toFixed(1)}</strong>
              <span className='sr-only'> out of 5</span> ({rating.count} {rating.count === 1 ? 'review' : 'reviews'})
            </>
          ) : (
            'No reviews yet'
          )}
        </p>
      </div>
    </div>
  );
}

export default async function ListingPage({params}) {
  const {id} = await params;
  const {listing, failed} = await loadListing(id);

  if (failed) {
    return (
      <div className={styles.notice} role='alert'>
        <p>This listing couldn&apos;t load right now.</p>
        <a href={ROUTES.listing(id)} className='btn btn-quiet'>
          Try again
        </a>
      </div>
    );
  }

  const now = new Date();
  const state = saleState(listing, now);
  const rating = await getSellerRating(listing.seller?._id).catch(() => ({average: null, count: 0}));
  const isAuction = listing.saleType === 'auction';
  const hasBid = isAuction && listing.currentBid != null;
  const timeLeft = state === 'live' ? formatDuration(listing.endsAt, now) : null;
  const urgent = state === 'live' && new Date(listing.endsAt).getTime() - now.getTime() < 60 * 60 * 1000;
  const shownPrice = state === 'sold' && listing.soldPrice != null ? listing.soldPrice : hasBid ? listing.currentBid : listing.price;
  const secondaryActions = (
    <div className={styles.secondary}>
      <button type='button' className='btn btn-quiet' disabled>
        Message seller
      </button>
      <button type='button' className='btn btn-quiet' disabled>
        Watch
      </button>
    </div>
  );

  return (
    <>
      {state === 'sold' && (
        <p className={`${styles.banner} ${styles.bannerSold}`} role='status'>
          This item has been sold.
        </p>
      )}
      {state === 'ended' && (
        <p className={`${styles.banner} ${styles.bannerEnded}`} role='status'>
          This auction has ended.
        </p>
      )}

      <div className={styles.layout}>
        <div className={styles.media}>
          <Gallery photos={listing.photos ?? []} title={listing.title} />
        </div>

        <aside className={styles.panel}>
          <div className={styles.tags}>
            {listing.category && (
              <Link href={ROUTES.category(listing.category)} className={styles.tagLink}>
                {formatLabel(listing.category)}
              </Link>
            )}
            {listing.condition && <span className={styles.tagPlain}>{formatLabel(listing.condition)}</span>}
            {isAuction && <span className={styles.tagAuction}>Auction</span>}
          </div>

          <h1 className={styles.title}>{listing.title}</h1>

          <div className={styles.priceBlock}>
            <span className={styles.priceLabel}>
              {state === 'sold' ? 'Sold for' : !isAuction ? 'Price' : !hasBid ? 'Starting bid' : state === 'ended' ? 'Final bid' : 'Current bid'}
            </span>
            <span className={styles.price}>{formatPrice(shownPrice)}</span>
          </div>

          {isAuction && state !== 'sold' && (
            <dl className={styles.auction}>
              {state === 'live' && (
                <div className={urgent ? styles.urgent : undefined}>
                  <dt>Ends in</dt>
                  <dd>
                    <time dateTime={new Date(listing.endsAt).toISOString()}>{timeLeft}</time>
                  </dd>
                </div>
              )}
              {state === 'upcoming' && (
                <div>
                  <dt>Bidding opens</dt>
                  <dd>
                    <time dateTime={new Date(listing.startsAt).toISOString()}>{dateTime.format(new Date(listing.startsAt))}</time>
                  </dd>
                </div>
              )}
              {listing.endsAt && state !== 'live' && (
                <div>
                  <dt>{state === 'ended' ? 'Ended' : 'Ends'}</dt>
                  <dd>
                    <time dateTime={new Date(listing.endsAt).toISOString()}>{dateTime.format(new Date(listing.endsAt))}</time>
                  </dd>
                </div>
              )}
              {state === 'live' && (
                <div>
                  <dt>Closes</dt>
                  <dd>{dateTime.format(new Date(listing.endsAt))}</dd>
                </div>
              )}
              {listing.minIncrement != null && (
                <div>
                  <dt>Min. increment</dt>
                  <dd>{formatPrice(listing.minIncrement)}</dd>
                </div>
              )}
            </dl>
          )}

          {state === 'offer' && (
            <OfferPanel listingId={listing._id} sellerId={listing.sellerId} price={listing.price}>
              {secondaryActions}
            </OfferPanel>
          )}

          {state === 'live' && (
            <div className={styles.actions}>
              <button type='button' className='btn btn-primary' disabled>
                Place a bid
              </button>
              {secondaryActions}
            </div>
          )}

          <SellerCard seller={listing.seller} rating={rating} />
        </aside>

        <div className={styles.about}>
          <section aria-labelledby='listing-description'>
            <h2 id='listing-description'>Description</h2>
            <p className={styles.description}>{listing.description}</p>
          </section>

          <section aria-labelledby='listing-details'>
            <h2 id='listing-details'>Details</h2>
            <dl className={styles.details}>
              {listing.category && (
                <div>
                  <dt>Category</dt>
                  <dd>{formatLabel(listing.category)}</dd>
                </div>
              )}
              {listing.condition && (
                <div>
                  <dt>Condition</dt>
                  <dd>{formatLabel(listing.condition)}</dd>
                </div>
              )}
              <div>
                <dt>Sale type</dt>
                <dd>{formatLabel(listing.saleType)}</dd>
              </div>
              {listing.zip && (
                <div>
                  <dt>Location</dt>
                  <dd>ZIP {listing.zip}</dd>
                </div>
              )}
              <div>
                <dt>Listed</dt>
                <dd>
                  <time dateTime={new Date(listing.createdAt).toISOString()}>{dateOnly.format(new Date(listing.createdAt))}</time>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
