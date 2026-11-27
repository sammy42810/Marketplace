'use client';

import {useEffect, useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {authFetch} from '@/lib/authFetch';
import {ROUTES} from '@/lib/routes';
import ListingForm from '@/components/ListingForm';

export default function EditListingPage() {
  const {id} = useParams();
  const {user, loading: authLoading} = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user || !user.emailVerified) return;

    async function loadListing() {
      setLoading(true);
      setError('');
      setListing(null);

      try {
        const me = await authFetch('/api/me');
        const data = await authFetch(`/api/listings/${id}`);

        if (data.listing.sellerId !== me.user.id) {
          setError('You can only edit your own listings.');
          return;
        }

        if (
          data.listing.status !== 'active' ||
          data.listing.currentBid != null
        ) {
          setError('This listing can no longer be edited.');
          return;
        }

        setListing(data.listing);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadListing();
  }, [id, user, authLoading]);

  if (authLoading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return (
      <div>
        <h1>Edit listing</h1>
        <p>You must sign in to edit a listing.</p>
        <Link href={ROUTES.login}>Sign in</Link>
      </div>
    );
  }

  if (!user.emailVerified) {
    return <p>Please verify your email before editing a listing.</p>;
  }

  if (loading) {
    return <p>Loading listing...</p>;
  }

  if (error) {
    return (
      <div>
        <h1>Edit listing</h1>
        <p role="alert">{error}</p>
        <Link href={ROUTES.listing(id)}>Back to listing</Link>
      </div>
    );
  }

  if (!listing) {
    return <p>Listing not found.</p>;
  }

  return <ListingForm key={id} listing={listing} />;
}
