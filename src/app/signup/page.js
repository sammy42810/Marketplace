'use client';

import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {createUserWithEmailAndPassword, sendEmailVerification, updateProfile} from 'firebase/auth';
import {getClientAuth} from '@/lib/firebaseClient';
import {authErrorMessage} from '@/lib/authErrors';
import {useAuth} from '@/context/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import FirebaseMissing from '@/components/FirebaseMissing';
import styles from '../auth.module.css';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpPage() {
  const router = useRouter();
  const {configured} = useAuth();
  const [form, setForm] = useState({displayName: '', email: '', password: '', confirm: ''});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm({...form, [field]: event.target.value});

  const handleSubmit = async (event) => {
    event.preventDefault();
    const displayName = form.displayName.trim();
    const email = form.email.trim();

    if (!displayName) return setError('Enter the name other users will see.');
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (form.password !== form.confirm) return setError('The passwords do not match.');

    setBusy(true);
    setError(null);
    try {
      const {user} = await createUserWithEmailAndPassword(getClientAuth(), email, form.password);
      await updateProfile(user, {displayName});
      await sendEmailVerification(user);
      // Refresh the token so the server sees the display name on the first request.
      await user.getIdToken(true);
      router.push('/status?welcome=1');
    } catch (caught) {
      setError(authErrorMessage(caught));
      setBusy(false);
    }
  };

  if (!configured) return <FirebaseMissing />;

  return (
    <section className={styles.panel}>
      <h1>Create an account</h1>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {error && (
          <p className={styles.error} role='alert'>
            {error}
          </p>
        )}
        <label className={styles.field}>
          Display name
          <input value={form.displayName} onChange={update('displayName')} autoComplete='nickname' maxLength={50} required />
        </label>
        <label className={styles.field}>
          Email
          <input type='email' value={form.email} onChange={update('email')} autoComplete='email' required />
        </label>
        <label className={styles.field}>
          Password
          <input
            type='password'
            value={form.password}
            onChange={update('password')}
            autoComplete='new-password'
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>
        <label className={styles.field}>
          Confirm password
          <input type='password' value={form.confirm} onChange={update('confirm')} autoComplete='new-password' required />
        </label>
        <button type='submit' className={styles.primary} disabled={busy}>
          {busy ? 'Creating account...' : 'Sign up'}
        </button>
        <p className={styles.divider}>or</p>
        <GoogleSignInButton onSignedIn={() => router.push('/')} onError={setError} />
      </form>
      <p className={styles.links}>
        <span>
          Already have an account? <Link href='/login'>Log in</Link>
        </span>
      </p>
    </section>
  );
}

