'use client';

import {useState} from 'react';
import Link from 'next/link';
import {sendPasswordResetEmail} from 'firebase/auth';
import {getClientAuth} from '@/lib/firebaseClient';
import {authErrorMessage} from '@/lib/authErrors';
import {useAuth} from '@/context/AuthContext';
import FirebaseMissing from '@/components/FirebaseMissing';
import styles from '../auth.module.css';

export default function ResetPasswordPage() {
  const {configured} = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return setError('Enter your email address.');
    setBusy(true);
    setError(null);
    try {
      await sendPasswordResetEmail(getClientAuth(), email.trim());
      setSent(true);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) return <FirebaseMissing />;

  return (
    <section className={styles.panel}>
      <h1>Reset your password</h1>
      {sent ? (
        <p className={styles.notice} role='status'>
          If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam folder.
        </p>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}
          <label className={styles.field}>
            Email
            <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} autoComplete='email' required />
          </label>
          <button type='submit' className={styles.primary} disabled={busy}>
            {busy ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className={styles.links}>
        <Link href='/login'>Back to log in</Link>
      </p>
    </section>
  );
}
