'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useAuth} from './AuthContext';
import {authFetch} from '@/lib/authFetch';
import {getSocket} from '@/lib/socketClient';
import {notificationKind} from '@/lib/notificationTypes';
import Toasts from '@/components/Toasts';

const NotificationsContext = createContext(null);
const TOAST_MS = 6000;
const MAX_TOASTS = 3;

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

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
    const data = await authFetch('/api/notifications');
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
    authFetch('/api/notifications').then(
      (data) => {
        if (cancelled) return;
        setItems(data.notifications);
        setHasMore(data.hasMore);
        setUnread(data.unread);
        setStatus('ready');
      },
      () => !cancelled && setStatus('error')
    );

    let connectedOnce = false;
    const onConnect = () => {
      if (connectedOnce) refresh().catch(() => {});
      connectedOnce = true;
    };
    const onNotification = ({notification}) => {
      setItems((list) => (list.some((item) => item._id === notification._id) ? list : [notification, ...list]));
      if (!notification.read) setUnread((count) => count + 1);
      if (notificationKind(notification.type).toast) showToast(notification);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh().catch(() => {});
    };

    socket.on('connect', onConnect);
    socket.on('notification:new', onNotification);
    document.addEventListener('visibilitychange', onVisible);
    if (socket.connected) socket.disconnect();
    socket.connect();

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
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
        return refresh().catch(() => setStatus('error'));
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
