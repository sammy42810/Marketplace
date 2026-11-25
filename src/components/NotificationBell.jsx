'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useNotifications} from '@/context/NotificationsContext';
import {ROUTES} from '@/lib/routes';
import NotificationItem from './NotificationItem';
import styles from './NotificationBell.module.css';

const PREVIEW_COUNT = 6;

function badgeText(count) {
  return count > 99 ? '99+' : String(count);
}

export default function NotificationBell() {
  const {items, unread, status, markRead, markAllRead, retry} = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const pathname = usePathname();
  const onPage = pathname === ROUTES.notifications;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && wrapper.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const preview = items.slice(0, PREVIEW_COUNT);
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <div className={styles.bell} ref={wrapper}>
      <button
        type='button'
        className={styles.button}
        aria-label={label}
        aria-expanded={open}
        aria-controls='notification-panel'
        aria-current={onPage ? 'page' : undefined}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox='0 0 24 24' width='22' height='22' aria-hidden='true'>
          <path
            d='M6 10a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7z'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinejoin='round'
          />
          <path d='M10 20.5a2.2 2.2 0 0 0 4 0' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        </svg>
        {unread > 0 && (
          <span className={styles.badge} key={unread} aria-hidden='true'>
            {badgeText(unread)}
          </span>
        )}
      </button>

      <div id='notification-panel' className={styles.panel} hidden={!open}>
        <div className={styles.head}>
          <h2 className={styles.title}>Notifications</h2>
          {unread > 0 && (
            <button type='button' className={styles.textButton} onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {status === 'loading' && items.length === 0 && <p className={styles.note}>Loading...</p>}
        {status === 'error' && items.length === 0 && (
          <div className={styles.note}>
            <p>Could not load notifications.</p>
            <button type='button' className={styles.textButton} onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {status === 'unverified' && (
          <div className={styles.note}>
            <p>Verify your email to get notifications.</p>
            <Link href='/status' className={styles.textButton} onClick={() => setOpen(false)}>
              Check verification
            </Link>
          </div>
        )}
        {status === 'ready' && items.length === 0 && (
          <p className={styles.note}>Nothing yet. Offers, bids and messages will show up here.</p>
        )}

        {preview.length > 0 && (
          <ul className={styles.list}>
            {preview.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                compact
                onOpen={(item) => {
                  markRead(item._id);
                  setOpen(false);
                }}
                onMarkRead={markRead}
              />
            ))}
          </ul>
        )}

        <Link href={ROUTES.notifications} className={styles.all} onClick={() => setOpen(false)}>
          See all notifications
        </Link>
      </div>
    </div>
  );
}
