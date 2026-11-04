'use client';

import {Suspense, useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {sendEmailVerification} from 'firebase/auth';
import {useAuth} from '@/context/AuthContext';
import {authFetch} from '@/lib/authFetch';
import {getSocket} from '@/lib/socketClient';
import styles from './status.module.css';

function Row({label, state, children}) {
  const text = state === true ? 'OK' : state === false ? 'Failed' : 'Checking...';
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>
        <span className={state === true ? styles.ok : state === false ? styles.bad : styles.wait}>{text}</span>
        {children && <span className={styles.detail}>{children}</span>}
      </dd>
    </div>
  );
}

function StatusChecks() {
  const {user, loading} = useAuth();
  const welcome = useSearchParams().get('welcome') === '1';
  const [services, setServices] = useState(null);
  const [me, setMe] = useState({state: null});
  const [socketState, setSocketState] = useState({state: null});
  const [verifyNote, setVerifyNote] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then(setServices)
      .catch(() => setServices({mongo: false, elasticsearch: false, imagemagick: false}));
  }, []);

  const checkMe = useCallback(async () => {
    setMe({state: null});
    try {
      const data = await authFetch('/api/me');
      setMe({state: true, user: data.user});
    } catch (error) {
      setMe({state: false, message: error.message});
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    checkMe();

    const socket = getSocket();
    const onConnect = () => {
      const sentAt = Date.now();
      socket.emit('ping', () => setSocketState({state: true, ms: Date.now() - sentAt}));
    };
    const onError = (error) => setSocketState({state: false, message: error.message});
    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      socket.disconnect();
    };
  }, [user, checkMe]);

  const refreshVerification = async () => {
    await user.reload();
    await user.getIdToken(true);
    setVerifyNote(user.emailVerified ? 'Email verified.' : 'Not verified yet. Open the link in the email first.');
    checkMe();
  };

  const resendVerification = async () => {
    try {
      await sendEmailVerification(user);
      setVerifyNote(`Sent a new link to ${user.email}.`);
    } catch {
      setVerifyNote('Could not send the email. Wait a minute and try again.');
    }
  };

  return (
    <section>
      <h1>Setup check</h1>
      {welcome && <p className={styles.welcome}>Account created. We sent a verification link to your email.</p>}

      <h2>Docker services</h2>
      <dl className={styles.list}>
        <Row label='MongoDB' state={services?.mongo ?? null} />
        <Row label='Elasticsearch' state={services?.elasticsearch ?? null} />
        <Row label='ImageMagick' state={services?.imagemagick ?? null} />
      </dl>

      <h2>Your account</h2>
      {loading ? (
        <p>Checking sign-in...</p>
      ) : !user ? (
        <p>
          <Link href='/login?next=/status'>Log in</Link> or <Link href='/signup'>sign up</Link> to check the server and
          socket connections.
        </p>
      ) : (
        <dl className={styles.list}>
          <Row label='Firebase sign-in' state={true}>
            {user.email}
          </Row>
          <Row label='Email verified' state={user.emailVerified}>
            {!user.emailVerified && (
              <>
                <button type='button' onClick={refreshVerification}>
                  I have verified it
                </button>{' '}
                <button type='button' onClick={resendVerification}>
                  Resend link
                </button>
              </>
            )}
            {verifyNote}
          </Row>
          <Row label='Server token check (/api/me)' state={me.state}>
            {me.state === true && `MongoDB user ${me.user.id}`}
            {me.state === false && me.message}
          </Row>
          <Row label='Socket.io connection' state={socketState.state}>
            {socketState.state === true && `ping ${socketState.ms} ms`}
            {socketState.state === false && socketState.message}
          </Row>
        </dl>
      )}
    </section>
  );
}

export default function StatusPage() {
  return (
    <Suspense>
      <StatusChecks />
    </Suspense>
  );
}
