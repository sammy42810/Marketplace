'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {useNotifications} from '@/context/NotificationsContext';
import NotificationItem from '@/components/NotificationItem';
import {formatDay, isSameDay} from '@/lib/format';
import {ROUTES} from '@/lib/routes';
import styles from './notifications.module.css';

const FILTERS = [
  {value: 'all', label: 'All'},
  {value: 'unread', label: 'Unread'}
];

function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, item.createdAt)) last.items.push(item);
    else groups.push({date: item.createdAt, items: [item]});
  }
  return groups;
}

export default function NotificationCenter() {
  const {user, loading} = useAuth();
  const router = useRouter();
  const {items, unread, hasMore, status, loadingMore, markRead, markAllRead, loadMore, retry} = useNotifications();
  const [filter, setFilter] = useState('all');
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.replace(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.notifications)}`);
  }, [user, loading, router]);

  if (loading || !user) return <p className={styles.status}>Loading notifications...</p>;

  const visible = filter === 'unread' ? items.filter((item) => !item.read) : items;
  const groups = groupByDay(visible);

  const more = async () => {
    setLoadError(null);
    try {
      await loadMore();
    } catch (caught) {
      setLoadError(caught.message);
    }
  };

  return (
    <section className={styles.page} aria-labelledby='notifications-heading'>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 id='notifications-heading'>Notifications</h1>
          <span className={styles.count}>{unread > 0 ? `${unread} unread` : 'All caught up'}</span>
        </div>
        <div className={styles.controls}>
          <div className={styles.filters} role='group' aria-label='Show'>
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type='button'
                className={styles.filter}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type='button' className='btn btn-quiet' onClick={markAllRead} disabled={unread === 0}>
            Mark all read
          </button>
        </div>
      </header>

      {status === 'loading' && items.length === 0 && <p className={styles.status}>Loading notifications...</p>}

      {status === 'error' && items.length === 0 && (
        <div className={styles.empty} role='alert'>
          <p>Could not load your notifications.</p>
          <button type='button' className='btn btn-quiet' onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {status === 'unverified' && (
        <div className={styles.empty}>
          <p>Verify your email address to get notifications. Open the link we emailed you, then check again.</p>
          <Link href='/status' className='btn btn-quiet'>
            Check verification
          </Link>
        </div>
      )}

      {status === 'ready' && visible.length === 0 && (
        <div className={styles.empty}>
          <p>{filter === 'unread' ? 'No unread notifications.' : 'No notifications yet. Offers, bids, auction results and messages will show up here.'}</p>
          {filter === 'unread' ? (
            <button type='button' className='btn btn-quiet' onClick={() => setFilter('all')}>
              Show all
            </button>
          ) : (
            <Link href={ROUTES.home} className='btn btn-quiet'>
              Browse listings
            </Link>
          )}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.date} className={styles.group}>
          <h2 className={styles.day}>{formatDay(group.date)}</h2>
          <ul className={styles.list}>
            {group.items.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onOpen={(item) => markRead(item._id)}
                onMarkRead={markRead}
              />
            ))}
          </ul>
        </div>
      ))}

      {hasMore && (
        <div className={styles.more}>
          {loadError && (
            <p className={styles.error} role='alert'>
              {loadError}
            </p>
          )}
          <button type='button' className='btn btn-quiet' onClick={more} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load older notifications'}
          </button>
        </div>
      )}
    </section>
  );
}
