'use client';

import {Suspense, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {getClientAuth} from '@/lib/firebaseClient';
import {authErrorMessage, safeNextPath} from '@/lib/authErrors';
import {useAuth} from '@/context/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import FirebaseMissing from '@/components/FirebaseMissing';
import styles from '../auth.module.css';

function LoginForm() {
  const router = useRouter();
  const nextPath = safeNextPath(useSearchParams().get('next'));
  const {configured} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(getClientAuth(), email.trim(), password);
      router.push(nextPath);
    } catch (caught) {
      setError(authErrorMessage(caught));
      setBusy(false);
    }
  };

  if (!configured) return <FirebaseMissing />;

  return (
    <section className={styles.panel}>
      <h1>Log in</h1>
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
        <label className={styles.field}>
          Password
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='current-password'
            required
          />
        </label>
        <button type='submit' className={styles.primary} disabled={busy}>
          {busy ? 'Logging in...' : 'Log in'}
        </button>
        <p className={styles.divider}>or</p>
        <GoogleSignInButton onSignedIn={() => router.push(nextPath)} onError={setError} />
      </form>
      <p className={styles.links}>
        <Link href='/reset-password'>Forgot your password?</Link>
        <Link href='/signup'>Create an account</Link>
      </p>
    </section>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
