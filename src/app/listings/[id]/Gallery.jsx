'use client';

import {useState} from 'react';
import styles from './listing.module.css';

export default function Gallery({photos, title}) {
  const [index, setIndex] = useState(0);
  const total = photos.length;

  if (total === 0) {
    return (
      <div className={styles.gallery}>
        <div className={`${styles.stage} ${styles.empty}`}>No photos</div>
      </div>
    );
  }

  const photo = photos[index];
  const go = (step) => setIndex((current) => (current + step + total) % total);

  function onKeyDown(event) {
    if (total < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    }
  }

  return (
    <div className={styles.gallery}>
      <div
        className={styles.stage}
        role='group'
        aria-roledescription='carousel'
        aria-label={`${title} photos`}
        tabIndex={total > 1 ? 0 : undefined}
        onKeyDown={onKeyDown}
      >
        <img
          key={photo.full}
          src={photo.full || photo.card}
          alt={`${title}, photo ${index + 1} of ${total}`}
          width={1200}
          height={900}
          fetchPriority={index === 0 ? 'high' : undefined}
        />
        {total > 1 && (
          <>
            <button type='button' className={`${styles.arrow} ${styles.prev}`} onClick={() => go(-1)} aria-label='Previous photo'>
              <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                <path d='M15 5l-7 7 7 7' fill='none' stroke='currentColor' strokeWidth='2.5' />
              </svg>
            </button>
            <button type='button' className={`${styles.arrow} ${styles.next}`} onClick={() => go(1)} aria-label='Next photo'>
              <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                <path d='M9 5l7 7-7 7' fill='none' stroke='currentColor' strokeWidth='2.5' />
              </svg>
            </button>
            <span className={styles.counter} aria-live='polite'>
              {index + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className={styles.thumbs}>
          {photos.map((item, i) => (
            <li key={item.thumb + i}>
              <button
                type='button'
                className={styles.thumb}
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${total}`}
                aria-current={i === index ? 'true' : undefined}
              >
                <img src={item.thumb || item.card} alt='' width={120} height={90} loading='lazy' />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
