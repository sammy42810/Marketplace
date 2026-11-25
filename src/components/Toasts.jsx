'use client';

import Link from 'next/link';
import {notificationHref, notificationKind} from '@/lib/notificationTypes';
import styles from './Toasts.module.css';

export default function Toasts({toasts, onDismiss, onOpen}) {
  return (
    <div className={styles.region} role='region' aria-label='Alerts' aria-live='polite'>
      {toasts.map((toast) => {
        const kind = notificationKind(toast.type);
        return (
          <div key={toast._id} className={styles.toast} data-tone={kind.tone}>
            <Link
              href={notificationHref(toast)}
              className={styles.body}
              onClick={() => {
                onOpen(toast._id);
                onDismiss(toast._id);
              }}
            >
              <span className={styles.label}>{kind.label}</span>
              <span className={styles.message}>{toast.message}</span>
            </Link>
            <button type='button' className={styles.close} onClick={() => onDismiss(toast._id)}>
              <svg viewBox='0 0 24 24' width='16' height='16' aria-hidden='true'>
                <path d='M6 6l12 12M18 6L6 18' fill='none' stroke='currentColor' strokeWidth='2.2' />
              </svg>
              <span className='sr-only'>Dismiss</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
