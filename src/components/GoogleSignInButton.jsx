'use client';

import {useState} from 'react';
import {GoogleAuthProvider, signInWithPopup} from 'firebase/auth';
import {getClientAuth} from '@/lib/firebaseClient';
import {authErrorMessage} from '@/lib/authErrors';
import styles from '@/app/auth.module.css';

export default function GoogleSignInButton({onSignedIn, onError}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    onError(null);
    try {
      await signInWithPopup(getClientAuth(), new GoogleAuthProvider());
      onSignedIn();
    } catch (error) {
      onError(authErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <button type='button' className={styles.secondary} onClick={handleClick} disabled={busy}>
      {busy ? 'Opening Google...' : 'Continue with Google'}
    </button>
  );
}
