'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {authFetch} from '@/lib/authFetch';
import {getSocket} from '@/lib/socketClient';
import {formatShortTime} from '@/lib/format';
import {ROUTES} from '@/lib/routes';
import styles from './inbox.module.css';

const InboxContext = createContext(null);

export function useInbox() {
  const value = useContext(InboxContext);
  if (!value) throw new Error('useInbox must be used inside <InboxShell>.');
  return value;
}

function activeId(pathname) {
  const match = /^\/inbox\/([0-9a-f]{24})$/i.exec(pathname ?? '');
  return match ? match[1].toLowerCase() : null;
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function ConversationItem({conversation, meId, current}) {
  const name = conversation.otherUser?.displayName || (conversation.role === 'buyer' ? 'Seller' : 'Buyer');
  const last = conversation.lastMessage;
  const mine = last && last.senderId === meId;
  const thumb = conversation.listing?.thumb;

  return (
    <li>
      <Link
        href={`${ROUTES.inbox}/${conversation._id}`}
        className={styles.item}
        aria-current={current ? 'page' : undefined}
        data-unread={conversation.unread > 0 ? 'true' : undefined}
      >
        {thumb ? (
          <img className={styles.thumb} src={thumb} alt='' width={56} height={56} loading='lazy' />
        ) : (
          <span className={styles.thumb} aria-hidden='true'>
            {initial(conversation.listing?.title)}
          </span>
        )}
        <span className={styles.itemBody}>
          <span className={styles.itemTop}>
            <span className={styles.itemName}>{name}</span>
            {last && (
              <time className={styles.itemTime} dateTime={last.createdAt}>
                {formatShortTime(last.createdAt)}
              </time>
            )}
          </span>
          <span className={styles.itemListing}>{conversation.listing?.title ?? 'Listing removed'}</span>
          <span className={styles.itemPreview}>
            {mine && <span className={styles.you}>You: </span>}
            {last?.body ?? 'No messages yet'}
          </span>
        </span>
        {conversation.unread > 0 && (
          <span className={styles.badge}>
            {conversation.unread > 99 ? '99+' : conversation.unread}
            <span className='sr-only'> unread</span>
          </span>
        )}
      </Link>
    </li>
  );
}

export default function InboxShell({children}) {
  const {user, loading} = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const current = activeId(pathname);
  const currentRef = useRef(current);
  const [meId, setMeId] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState(null);

  const listRef = useRef(null);

  useEffect(() => {
    currentRef.current = current;
    listRef.current = conversations;
  }, [current, conversations]);

  const reload = useCallback(async () => {
    const data = await authFetch('/api/conversations');
    setConversations(data.conversations);
    setError(null);
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    if (!user) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(window.location.pathname)}`);
      return undefined;
    }
    let cancelled = false;
    Promise.all([authFetch('/api/me'), authFetch('/api/conversations')]).then(
      ([{user: me}, data]) => {
        if (cancelled) return;
        setMeId(me.id);
        setConversations(data.conversations);
        setError(null);
      },
      (caught) => !cancelled && setError(caught.message)
    );
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  useEffect(() => {
    if (!meId) return undefined;
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onMessage = ({message}) => {
      if (!listRef.current?.some((item) => item._id === message.conversationId)) {
        reload().catch(() => {});
        return;
      }
      setConversations((list) => {
        const index = list.findIndex((item) => item._id === message.conversationId);
        if (index === -1) return list;
        const item = list[index];
        const unseen = message.recipientId === meId && currentRef.current !== message.conversationId;
        const updated = {
          ...item,
          lastMessage: {body: message.body, senderId: message.senderId, createdAt: message.createdAt},
          updatedAt: message.createdAt,
          unread: unseen ? item.unread + 1 : item.unread
        };
        return [updated, ...list.slice(0, index), ...list.slice(index + 1)];
      });
    };

    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [meId, reload]);

  const markSeen = useCallback((conversationId) => {
    setConversations((list) => list?.map((item) => (item._id === conversationId ? {...item, unread: 0} : item)) ?? list);
  }, []);

  const value = useMemo(() => ({meId, markSeen, reload}), [meId, markSeen, reload]);

  if (loading || !user) return <p className={styles.status}>Loading your inbox...</p>;

  return (
    <InboxContext.Provider value={value}>
      <div className={styles.shell} data-thread={current ? 'open' : 'closed'}>
        <section className={styles.list} aria-labelledby='inbox-heading'>
          <div className={styles.listHead}>
            <h1 id='inbox-heading'>Inbox</h1>
            {conversations && <span className={styles.total}>{conversations.length}</span>}
          </div>
          {error && (
            <div className={styles.listNotice} role='alert'>
              <p>{error}</p>
              <button type='button' className='btn btn-quiet' onClick={() => reload().catch((caught) => setError(caught.message))}>
                Try again
              </button>
            </div>
          )}
          {!error && !conversations && <p className={styles.status}>Loading conversations...</p>}
          {!error && conversations?.length === 0 && (
            <div className={styles.listNotice}>
              <p>No conversations yet. Use Message seller on a listing to start one.</p>
              <Link href={ROUTES.home} className='btn btn-quiet'>
                Browse listings
              </Link>
            </div>
          )}
          {!error && conversations?.length > 0 && (
            <ul className={styles.items}>
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation._id}
                  conversation={conversation}
                  meId={meId}
                  current={conversation._id === current}
                />
              ))}
            </ul>
          )}
        </section>
        <div className={styles.pane}>{meId ? children : null}</div>
      </div>
    </InboxContext.Provider>
  );
}
