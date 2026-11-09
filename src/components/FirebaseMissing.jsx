import styles from '@/app/auth.module.css';

export default function FirebaseMissing() {
  return (
    <section className={styles.panel}>
      <h1>Sign-in is not set up yet</h1>
      <p>Add the Firebase values to .env.local (see .env.example), then restart the server.</p>
    </section>
  );
}
