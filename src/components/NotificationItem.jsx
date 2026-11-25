'use client';

import Link from 'next/link';
import {formatClock, formatShortTime} from '@/lib/format';
import {notificationHref, notificationKind} from '@/lib/notificationTypes';
import styles from './NotificationItem.module.css';

export default function NotificationItem({notification, onOpen, onMarkRead, compact = false}) {
  const kind = notificationKind(notification.type);
  const unread = !notification.read;

  return (
    <li className={styles.item} data-tone={kind.tone} data-unread={unread ? 'true' : undefined} data-compact={compact ? 'true' : undefined}>
      <Link href={notificationHref(notification)} className={styles.link} onClick={() => onOpen(notification)}>
        <span className={styles.meta}>
          <span className={styles.label}>{kind.label}</span>
          <time className={styles.time} dateTime={notification.createdAt}>
            {compact ? formatShortTime(notification.createdAt) : formatClock(notification.createdAt)}
          </time>
        </span>
        <span className={styles.message}>{notification.message}</span>
        {unread && <span className='sr-only'>Unread</span>}
      </Link>
      {unread && onMarkRead && (
        <button type='button' className={styles.mark} title='Mark as read' onClick={() => onMarkRead(notification._id)}>
          <span className={styles.dot} aria-hidden='true' />
          <span className='sr-only'>Mark as read</span>
        </button>
      )}
    </li>
  );
}
