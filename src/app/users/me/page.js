'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {authFetch} from '@/lib/authFetch';
import {ROUTES} from '@/lib/routes';

// Profiles are addressed by MongoDB id, which only the server knows, so look it up and redirect.
export default function MyProfilePage() {
  const {user, loading} = useAuth();
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loading) return undefined;
    if (!user) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.myProfile)}`);
      return undefined;
    }
    let cancelled = false;
    authFetch('/api/me').then(
      ({user: me}) => !cancelled && router.replace(ROUTES.profile(me.id)),
      (caught) => !cancelled && setError(caught.message)
    );
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  return error ? <p role='alert'>{error}</p> : <p>Loading your profile...</p>;
}
