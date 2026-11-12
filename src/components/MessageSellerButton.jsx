'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {authFetch} from '@/lib/authFetch';
import {ROUTES} from '@/lib/routes';
import styles from './MessageSellerButton.module.css';

export default function MessageSellerButton({listingId, sellerId, className = 'btn btn-quiet'}) {
  const {user, loading} = useAuth();
  const router = useRouter();
  const [meId, setMeId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setMeId(null);
      return undefined;
    }
    let cancelled = false;
    authFetch('/api/me').then(
      ({user: me}) => !cancelled && setMeId(me.id),
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <button type='button' className={className} disabled>
        Message seller
      </button>
    );
  }

  if (!user) {
    return (
      <Link href={`${ROUTES.login}?next=${encodeURIComponent(ROUTES.listing(listingId))}`} className={className}>
        Message seller
      </Link>
    );
  }

  if (meId === sellerId) return null;

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const {conversation} = await authFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({listingId})
      });
      router.push(`${ROUTES.inbox}/${conversation._id}`);
    } catch (caught) {
      setError(caught.message);
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <button
        type='button'
        className={className}
        onClick={open}
        disabled={busy || !meId}
        aria-describedby={error ? `message-error-${listingId}` : undefined}
      >
        {busy ? 'Opening...' : 'Message seller'}
      </button>
      {error && (
        <p id={`message-error-${listingId}`} role='alert' className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
