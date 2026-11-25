'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {onIdTokenChanged} from 'firebase/auth';
import {useAuth} from './AuthContext';
import {authFetch} from '@/lib/authFetch';
import {getClientAuth} from '@/lib/firebaseClient';
import {getSocket} from '@/lib/socketClient';
import {notificationKind} from '@/lib/notificationTypes';
import Toasts from '@/components/Toasts';

const NotificationsContext = createContext(null);

function isNewAccount(firebaseUser) {
  const created = Date.parse(firebaseUser.metadata?.creationTime ?? '');
  return Number.isFinite(created) && Date.now() - created < NEW_ACCOUNT_MS;
}

function loadFailure(error) {
  return error?.status === 403 ? 'unverified' : 'error';
}
const TOAST_MS = 6000;
const MAX_TOASTS = 3;
const NEW_ACCOUNT_MS = 2 * 60 * 1000;
const NAME_WAIT_MS = 15_000;

function mergeNewest(current, incoming) {
  const seen = new Set(incoming.map((item) => item._id));
  return [...incoming, ...current.filter((item) => !seen.has(item._id))];
}

export function NotificationsProvider({children}) {
  const {user} = useAuth();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('idle');
  const [loadingMore, setLoadingMore] = useState(false);
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const uidRef = useRef(uid);
  const extended = useRef(false);
  const itemsRef = useRef(items);
  const statusRef = useRef(status);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((toast) => toast._id !== id));
  }, []);

  const showToast = useCallback(
    (notification) => {
      setToasts((list) => [notification, ...list.filter((toast) => toast._id !== notification._id)].slice(0, MAX_TOASTS));
      clearTimeout(timers.current.get(notification._id));
      timers.current.set(notification._id, setTimeout(() => dismissToast(notification._id), TOAST_MS));
    },
    [dismissToast]
  );

  const refresh = useCallback(async () => {
    const requestedFor = uidRef.current;
    let data;
    try {
      data = await authFetch('/api/notifications');
    } catch (error) {
      if (uidRef.current === requestedFor && error?.status === 403) setStatus('unverified');
      throw error;
    }
    if (uidRef.current !== requestedFor) return;
    setItems((current) => mergeNewest(current, data.notifications));
    if (!extended.current) setHasMore(data.hasMore);
    setUnread(data.unread);
    setStatus('ready');
  }, []);

  useEffect(() => {
    uidRef.current = uid;
    extended.current = false;
    setItems([]);
    setUnread(0);
    setHasMore(false);
    setToasts([]);
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();

    const socket = getSocket();
    if (!uid) {
      setStatus('idle');
      if (socket.connected) socket.disconnect();
      return undefined;
    }

    setStatus('loading');
    let cancelled = false;
    let started = false;
    let connectedOnce = false;
    let reconnectTimer = null;

    const onConnect = () => {
      if (connectedOnce) refresh().catch(() => {});
      connectedOnce = true;
    };
    const onDisconnect = (reason) => {
      if (reason !== 'io client disconnect') return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (!cancelled && !socket.connected) socket.connect();
      }, 0);
    };
    const onNotification = ({notification}) => {
      setItems((list) => (list.some((item) => item._id === notification._id) ? list : [notification, ...list]));
      if (!notification.read) setUnread((count) => count + 1);
      if (notificationKind(notification.type).toast) showToast(notification);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh().catch(() => {});
    };

    const begin = () => {
      if (started || cancelled) return;
      started = true;
      clearTimeout(nameTimer);
      authFetch('/api/notifications').then(
        (data) => {
          if (cancelled) return;
          setItems(data.notifications);
          setHasMore(data.hasMore);
          setUnread(data.unread);
          setStatus('ready');
        },
        (error) => !cancelled && setStatus(loadFailure(error))
      );
      if (socket.connected) socket.disconnect();
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('notification:new', onNotification);
      document.addEventListener('visibilitychange', onVisible);
      socket.connect();
    };

    const onToken = async (firebaseUser) => {
      if (cancelled || !firebaseUser || firebaseUser.uid !== uid) return;
      if (started) {
        if (statusRef.current === 'unverified') refresh().catch(() => {});
        return;
      }
      if (isNewAccount(firebaseUser)) {
        const {claims} = await firebaseUser.getIdTokenResult();
        if (!claims.name) return;
      }
      begin();
    };

    const nameTimer = setTimeout(begin, NAME_WAIT_MS);
    const auth = getClientAuth();
    const unsubscribe = auth ? onIdTokenChanged(auth, (firebaseUser) => onToken(firebaseUser).catch(begin)) : () => {};
    if (!auth) begin();

    return () => {
      cancelled = true;
      clearTimeout(nameTimer);
      clearTimeout(reconnectTimer);
      unsubscribe();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification:new', onNotification);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, showToast, refresh]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const markRead = useCallback(
    async (id) => {
      const target = itemsRef.current.find((item) => item._id === id);
      if (!target || target.read) return;
      setItems((list) => list.map((item) => (item._id === id ? {...item, read: true} : item)));
      setUnread((count) => Math.max(0, count - 1));
      try {
        await authFetch(`/api/notifications/${id}`, {method: 'PATCH', body: JSON.stringify({read: true})});
      } catch {
        refresh().catch(() => {});
      }
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    setItems((list) => list.map((item) => (item.read ? item : {...item, read: true})));
    setUnread(0);
    try {
      await authFetch('/api/notifications/read-all', {method: 'POST'});
    } catch {
      refresh().catch(() => {});
    }
  }, [refresh]);

  const loadMore = useCallback(async () => {
    const last = items[items.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    extended.current = true;
    try {
      const data = await authFetch(`/api/notifications?before=${last._id}`);
      setItems((list) => [...list, ...data.notifications.filter((item) => !list.some((existing) => existing._id === item._id))]);
      setHasMore(data.hasMore);
      setUnread(data.unread);
    } finally {
      setLoadingMore(false);
    }
  }, [items, loadingMore]);

  const value = useMemo(
    () => ({
      items,
      unread,
      hasMore,
      status,
      loadingMore,
      markRead,
      markAllRead,
      loadMore,
      retry: () => {
        setStatus('loading');
        return refresh().catch((error) => setStatus(loadFailure(error)));
      }
    }),
    [items, unread, hasMore, status, loadingMore, markRead, markAllRead, loadMore, refresh]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <Toasts toasts={toasts} onDismiss={dismissToast} onOpen={markRead} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used inside <NotificationsProvider>.');
  return value;
}
