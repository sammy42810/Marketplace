'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {authFetch} from '@/lib/authFetch';
import {getSocket} from '@/lib/socketClient';
import {formatPrice} from '@/lib/format';
import {ROUTES} from '@/lib/routes';
import listingStyles from './listing.module.css';
import styles from './OfferPanel.module.css';

const LIVE_TYPES = ['offer_received', 'offer_accepted', 'offer_declined', 'listing_sold'];
const STATUS_TEXT = {pending: 'Pending', accepted: 'Accepted', rejected: 'Declined', cancelled: 'Cancelled'};

const offerTime = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});

function parseAmount(value) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount > 0 ? amount : null;
}

function StatusChip({status}) {
  return (
    <span className={styles.chip} data-status={status}>
      {STATUS_TEXT[status] ?? status}
    </span>
  );
}

function BuyerView({listingId, price, offers, onChange}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pending = offers.find((offer) => offer.status === 'pending');
  const latest = offers[0];

  const submit = async (event) => {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null) return setError('Enter an amount like 40 or 39.50.');
    setBusy(true);
    setError(null);
    try {
      await authFetch(`/api/listings/${listingId}/offers`, {method: 'POST', body: JSON.stringify({amount: value})});
      setAmount('');
      await onChange();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await authFetch(`/api/offers/${pending._id}`, {method: 'PATCH', body: JSON.stringify({status: 'cancelled'})});
      await onChange();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <div className={styles.yours}>
        <div className={styles.yoursRow}>
          <span className={styles.yoursLabel}>Your offer</span>
          <StatusChip status='pending' />
        </div>
        <p className={styles.yoursAmount}>{formatPrice(pending.amount)}</p>
        <p className={styles.hint}>The seller will accept or decline it. You&apos;ll get a notification either way.</p>
        {error && (
          <p className={styles.error} role='alert'>
            {error}
          </p>
        )}
        <button type='button' className='btn btn-quiet' onClick={cancel} disabled={busy}>
          {busy ? 'Cancelling...' : 'Cancel offer'}
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {latest && latest.status !== 'accepted' && (
        <p className={styles.previous}>
          Your {formatPrice(latest.amount)} offer was {STATUS_TEXT[latest.status].toLowerCase()}.
        </p>
      )}
      <label htmlFor='offer-amount' className={styles.label}>
        Your offer
      </label>
      <div className={styles.inputRow}>
        <span className={styles.currency} aria-hidden='true'>
          $
        </span>
        <input
          id='offer-amount'
          inputMode='decimal'
          autoComplete='off'
          placeholder={String(price)}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'offer-error' : 'offer-hint'}
        />
      </div>
      <p id='offer-hint' className={styles.hint}>
        Asking price is {formatPrice(price)}.
      </p>
      {error && (
        <p id='offer-error' className={styles.error} role='alert'>
          {error}
        </p>
      )}
      <button type='submit' className='btn btn-primary' disabled={busy}>
        {busy ? 'Sending...' : 'Make an offer'}
      </button>
    </form>
  );
}

function SellerOffer({offer, onChange}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const name = offer.buyer?.displayName || 'Buyer';

  const respond = async (status) => {
    setBusy(true);
    setError(null);
    try {
      await authFetch(`/api/offers/${offer._id}`, {method: 'PATCH', body: JSON.stringify({status})});
      await onChange(status === 'accepted');
    } catch (caught) {
      setError(caught.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={styles.offer} data-status={offer.status}>
      <div className={styles.offerMain}>
        <span className={styles.offerAmount}>{formatPrice(offer.amount)}</span>
        <span className={styles.offerMeta}>
          {offer.buyer ? (
            <Link href={ROUTES.profile(offer.buyer._id)} className={styles.buyer}>
              {name}
            </Link>
          ) : (
            name
          )}
          {' · '}
          <time dateTime={offer.createdAt}>{offerTime.format(new Date(offer.createdAt))}</time>
        </span>
      </div>
      {offer.status === 'pending' ? (
        <div className={styles.offerActions}>
          {confirming ? (
            <>
              <button type='button' className='btn btn-primary' onClick={() => respond('accepted')} disabled={busy}>
                {busy ? 'Selling...' : `Sell for ${formatPrice(offer.amount)}`}
              </button>
              <button type='button' className='btn btn-quiet' onClick={() => setConfirming(false)} disabled={busy}>
                Back
              </button>
            </>
          ) : (
            <>
              <button type='button' className='btn btn-primary' onClick={() => setConfirming(true)} disabled={busy}>
                Accept
              </button>
              <button type='button' className='btn btn-quiet' onClick={() => respond('rejected')} disabled={busy}>
                Decline
              </button>
            </>
          )}
        </div>
      ) : (
        <StatusChip status={offer.status} />
      )}
      {error && (
        <p className={styles.error} role='alert'>
          {error}
        </p>
      )}
    </li>
  );
}

function SellerView({offers, onChange}) {
  const pending = offers.filter((offer) => offer.status === 'pending');
  const closed = offers.filter((offer) => offer.status !== 'pending');

  return (
    <section className={styles.seller} aria-labelledby='offers-heading'>
      <div className={styles.sellerHead}>
        <h2 id='offers-heading'>Offers</h2>
        <span className={styles.count}>{pending.length} pending</span>
      </div>
      {offers.length === 0 ? (
        <p className={styles.empty}>No offers yet. They&apos;ll show up here as soon as a buyer makes one.</p>
      ) : (
        <ul className={styles.offers}>
          {[...pending, ...closed].map((offer) => (
            <SellerOffer key={offer._id} offer={offer} onChange={onChange} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function OfferPanel({listingId, sellerId, price, children}) {
  const {user, loading} = useAuth();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState(null);

  const loadOffers = useCallback(async () => {
    const data = await authFetch(`/api/listings/${listingId}/offers`);
    setOffers(data.offers);
  }, [listingId]);

  useEffect(() => {
    if (!user) {
      setMe(null);
      setOffers(null);
      return undefined;
    }
    let cancelled = false;
    Promise.all([authFetch('/api/me'), authFetch(`/api/listings/${listingId}/offers`)]).then(
      ([{user: account}, data]) => {
        if (cancelled) return;
        setMe(account);
        setOffers(data.offers);
        setError(null);
      },
      (caught) => !cancelled && setError(caught.message)
    );
    return () => {
      cancelled = true;
    };
  }, [user, listingId]);

  useEffect(() => {
    if (!me) return undefined;
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const onNotification = ({notification}) => {
      if (notification.listingId !== listingId || !LIVE_TYPES.includes(notification.type)) return;
      if (notification.type === 'offer_accepted' || notification.type === 'listing_sold') router.refresh();
      else loadOffers().catch(() => {});
    };
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('notification:new', onNotification);
    };
  }, [me, listingId, loadOffers, router]);

  const handleChange = async (sold = false) => {
    if (sold) return router.refresh();
    await loadOffers();
  };

  if (loading || (user && !me && !error)) {
    return (
      <div className={listingStyles.actions}>
        <button type='button' className='btn btn-primary' disabled>
          Make an offer
        </button>
        {children}
      </div>
    );
  }

  if (!user) {
    return (
      <div className={listingStyles.actions}>
        <Link href={`${ROUTES.login}?next=${encodeURIComponent(ROUTES.listing(listingId))}`} className='btn btn-primary'>
          Log in to make an offer
        </Link>
        {children}
      </div>
    );
  }

  if (error) {
    return (
      <div className={listingStyles.actions}>
        <p className={styles.error} role='alert'>
          {error}
        </p>
        {children}
      </div>
    );
  }

  if (me.id === sellerId) return <SellerView offers={offers} onChange={handleChange} />;

  return (
    <div className={listingStyles.actions}>
      <BuyerView listingId={listingId} price={price} offers={offers} onChange={handleChange} />
      {children}
    </div>
  );
}
