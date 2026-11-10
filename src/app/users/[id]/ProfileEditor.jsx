'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {authFetch} from '@/lib/authFetch';
import styles from './profile.module.css';

const MAX_NAME = 50;

export default function ProfileEditor({profileId, displayName}) {
  const {user, refreshUser} = useAuth();
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsOwner(false);
      return undefined;
    }
    let cancelled = false;
    // If this check fails the edit button just stays hidden; the server checks ownership anyway.
    authFetch('/api/me').then(
      ({user: me}) => !cancelled && setIsOwner(me.id === profileId),
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [user, profileId]);

  if (!isOwner) return null;

  if (!editing) {
    return (
      <button
        type='button'
        className='btn btn-quiet'
        onClick={() => {
          setName(displayName);
          setError(null);
          setEditing(true);
        }}
      >
        Edit name
      </button>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter a display name.');
    if (trimmed.length > MAX_NAME) return setError(`Use ${MAX_NAME} characters or fewer.`);

    setBusy(true);
    setError(null);
    try {
      await authFetch('/api/me', {method: 'PATCH', body: JSON.stringify({displayName: trimmed})});
      await refreshUser();
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.editor} onSubmit={handleSubmit} noValidate>
      <label htmlFor='display-name'>Display name</label>
      <input
        id='display-name'
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={MAX_NAME}
        autoComplete='nickname'
        autoFocus
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? 'display-name-error' : undefined}
      />
      {error && (
        <p id='display-name-error' className={styles.error} role='alert'>
          {error}
        </p>
      )}
      <div className={styles.editorActions}>
        <button type='submit' className='btn btn-primary' disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </button>
        <button type='button' className='btn btn-quiet' onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
