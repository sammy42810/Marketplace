'use client';

import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import ListingForm from '@/components/ListingForm';
import {ROUTES} from '@/lib/routes';

export default function CreateListingPage() {
  const {user, loading} = useAuth();

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return (
      <div>
        <h1>Create listing</h1>
        <p>You must sign in to create a listing.</p>
        <Link href={ROUTES.login}>Sign in</Link>
      </div>
    );
  }

  if (!user.emailVerified) {
    return (
      <div>
        <h1>Create listing</h1>
        <p>Please verify your email before creating a listing.</p>
      </div>
    );
  }

  return <ListingForm />;
}
