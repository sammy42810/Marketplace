import {cache} from 'react';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import ListingCard from '@/components/ListingCard';
import RatingSummary from '@/components/RatingSummary';
import {HttpError} from '@/lib/server/auth';
import {browseListings, cardListing, getSellerRating} from '@/lib/server/listings';
import {getProfile} from '@/lib/server/profiles';
import {ROUTES} from '@/lib/routes';
import ProfileEditor from './ProfileEditor';
import styles from './profile.module.css';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;
const memberSince = new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric', timeZone: 'America/New_York'});

const loadProfile = cache(async (id) => {
  try {
    return {profile: await getProfile(id), failed: false};
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    console.error('Profile failed to load:', error.message);
    return {profile: null, failed: true};
  }
});

export async function generateMetadata({params}) {
  const {id} = await params;
  const {profile} = await loadProfile(id);
  return {title: profile?.displayName || 'Profile'};
}

export default async function ProfilePage({params}) {
  const {id} = await params;
  const {profile, failed} = await loadProfile(id);

  if (failed) {
    return (
      <div className={styles.notice} role='alert'>
        <p>This profile couldn&apos;t load right now.</p>
        <a href={ROUTES.profile(id)} className='btn btn-quiet'>
          Try again
        </a>
      </div>
    );
  }

  const [rating, forSale] = await Promise.all([
    getSellerRating(id).catch(() => ({average: null, count: 0})),
    browseListings(new URLSearchParams({seller: id, limit: String(PAGE_SIZE)})).catch(() => null)
  ]);
  const name = profile.displayName || 'Member';
  const now = new Date();

  return (
    <>
      <header className={styles.header}>
        {profile.photoUrl ? (
          <img className={styles.avatar} src={profile.photoUrl} alt='' width={72} height={72} referrerPolicy='no-referrer' />
        ) : (
          <span className={styles.avatar} aria-hidden='true'>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className={styles.identity}>
          <h1>{name}</h1>
          <p className={styles.meta}>Member since {memberSince.format(new Date(profile.createdAt))}</p>
          <RatingSummary rating={rating} className={styles.meta} />
        </div>
        <ProfileEditor profileId={profile._id} displayName={name} />
      </header>

      <section aria-labelledby='profile-listings' className={styles.section}>
        <h2 id='profile-listings'>For sale</h2>
        {!forSale && <p className={styles.empty}>Listings couldn&apos;t load right now.</p>}
        {forSale?.total === 0 && <p className={styles.empty}>{name} has nothing for sale right now.</p>}
        {forSale?.total > 0 && (
          <>
            {forSale.total > forSale.listings.length && (
              <p className={styles.meta}>
                Showing the newest {forSale.listings.length} of {forSale.total}.
              </p>
            )}
            <ul className={styles.grid}>
              {forSale.listings.map((listing) => (
                <li key={listing._id}>
                  <ListingCard listing={cardListing(listing)} now={now} />
                </li>
              ))}
            </ul>
          </>
        )}
        <p className={styles.back}>
          <Link href={ROUTES.home}>Back to all listings</Link>
        </p>
      </section>
    </>
  );
}
