import styles from './RatingSummary.module.css';

// rating is {average, count} from getSellerRating.
export default function RatingSummary({rating, className}) {
  return (
    <p className={className}>
      {rating.count > 0 ? (
        <>
          <span className={styles.stars} aria-hidden='true'>
            ★
          </span>
          <strong className={styles.average}>{rating.average.toFixed(1)}</strong>
          <span className='sr-only'> out of 5</span> ({rating.count} {rating.count === 1 ? 'review' : 'reviews'})
        </>
      ) : (
        'No reviews yet'
      )}
    </p>
  );
}
