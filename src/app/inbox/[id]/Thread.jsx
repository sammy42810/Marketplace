'use client';

import {Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {authFetch} from '@/lib/authFetch';
import {getSocket} from '@/lib/socketClient';
import {formatClock, formatDay, formatLabel, formatPrice, isSameDay} from '@/lib/format';
import {ROUTES} from '@/lib/routes';
import {useInbox} from '../InboxShell';
import styles from '../inbox.module.css';

const MAX_BODY = 2000;
const SEND_TIMEOUT_MS = 10_000;

function addMessages(list, incoming) {
  const seen = new Set(list.map((message) => message._id));
  const fresh = incoming.filter((message) => !seen.has(message._id));
  return fresh.length === 0 ? list : [...list, ...fresh];
}

function ThreadHeader({conversation}) {
  const other = conversation.otherUser;
  const name = other?.displayName || (conversation.role === 'buyer' ? 'Seller' : 'Buyer');
  const listing = conversation.listing;

  return (
    <header className={styles.threadHead}>
      <Link href={ROUTES.inbox} className={styles.back}>
        <svg viewBox='0 0 24 24' width='18' height='18' aria-hidden='true'>
          <path d='M15 5l-7 7 7 7' fill='none' stroke='currentColor' strokeWidth='2.5' />
        </svg>
        Inbox
      </Link>
      <div className={styles.party}>
        <span className={styles.partyRole}>{conversation.role === 'buyer' ? 'Seller' : 'Buyer'}</span>
        {other ? (
          <Link href={ROUTES.profile(other._id)} className={styles.partyName}>
            {name}
          </Link>
        ) : (
          <span className={styles.partyName}>{name}</span>
        )}
      </div>
      {listing && (
        <Link href={ROUTES.listing(listing._id)} className={styles.listing}>
          {listing.thumb ? (
            <img className={styles.listingThumb} src={listing.thumb} alt='' width={44} height={44} />
          ) : (
            <span className={styles.listingThumb} aria-hidden='true' />
          )}
          <span className={styles.listingTitle}>{listing.title}</span>
          {listing.status === 'active' ? (
            <span className={styles.listingPrice}>{formatPrice(listing.price)}</span>
          ) : (
            <span className={styles.listingStatus}>{formatLabel(listing.status)}</span>
          )}
        </Link>
      )}
    </header>
  );
}

function Messages({messages, meId, hasMore, loadingOlder, onLoadOlder, scrollRef}) {
  return (
    <div className={styles.messages} ref={scrollRef} role='log' aria-live='polite' aria-label='Messages'>
      {hasMore && (
        <button type='button' className={`btn btn-quiet ${styles.older}`} onClick={onLoadOlder} disabled={loadingOlder}>
          {loadingOlder ? 'Loading...' : 'Load older messages'}
        </button>
      )}
      {messages.length === 0 && <p className={styles.emptyThread}>No messages yet.</p>}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
        const mine = message.senderId === meId;
        const grouped = previous && !newDay && previous.senderId === message.senderId;
        return (
          <Fragment key={message._id}>
            {newDay && (
              <p className={styles.day}>
                <span>{formatDay(message.createdAt)}</span>
              </p>
            )}
            <div className={styles.message} data-mine={mine ? 'true' : undefined} data-grouped={grouped ? 'true' : undefined}>
              <p className={styles.bubble}>{message.body}</p>
              <time className={styles.messageTime} dateTime={message.createdAt}>
                {formatClock(message.createdAt)}
              </time>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function Composer({onSend}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);

  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = async (event) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (body.length > MAX_BODY) return setError(`Messages must be ${MAX_BODY} characters or fewer.`);
    setSending(true);
    setError(null);
    try {
      await onSend(body);
      setDraft('');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const remaining = MAX_BODY - draft.length;

  return (
    <form className={styles.composer} onSubmit={submit}>
      {error && (
        <p className={styles.sendError} role='alert'>
          {error}
        </p>
      )}
      <div className={styles.composeRow}>
        <label htmlFor='chat-input' className='sr-only'>
          Message
        </label>
        <textarea
          id='chat-input'
          ref={input}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder='Write a message'
          maxLength={MAX_BODY}
          autoFocus
        />
        <button type='submit' className='btn btn-primary' disabled={sending || !draft.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
      {remaining < 200 && <p className={styles.counter}>{remaining} characters left</p>}
    </form>
  );
}

export default function Thread({conversationId}) {
  const {meId, markSeen} = useInbox();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const keepOffset = useRef(null);

  const markRead = useCallback(() => {
    markSeen(conversationId);
    authFetch(`/api/conversations/${conversationId}/read`, {method: 'POST'}).catch(() => {});
  }, [conversationId, markSeen]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch(`/api/conversations/${conversationId}`),
      authFetch(`/api/conversations/${conversationId}/messages`)
    ]).then(
      ([{conversation: found}, page]) => {
        if (cancelled) return;
        setConversation(found);
        setMessages(page.messages);
        setHasMore(page.hasMore);
        if (found.unread > 0) markRead();
      },
      (caught) => !cancelled && setError(caught)
    );
    return () => {
      cancelled = true;
    };
  }, [conversationId, markRead]);

  useEffect(() => {
    if (!conversation) return undefined;
    const socket = getSocket();
    const join = () => socket.emit('chat:join', {conversationId}, () => {});
    const onMessage = ({message}) => {
      if (message.conversationId !== conversationId) return;
      setMessages((list) => addMessages(list, [message]));
      if (message.senderId !== meId) markRead();
    };

    socket.on('connect', join);
    socket.on('message:new', onMessage);
    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.off('connect', join);
      socket.off('message:new', onMessage);
      socket.emit('chat:leave', {conversationId});
    };
  }, [conversation, conversationId, meId, markRead]);

  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    if (keepOffset.current !== null) {
      box.scrollTop = box.scrollHeight - keepOffset.current;
      keepOffset.current = null;
      return;
    }
    box.scrollTop = box.scrollHeight;
  }, [messages]);

  const loadOlder = async () => {
    if (!messages[0]) return;
    setLoadingOlder(true);
    try {
      const page = await authFetch(`/api/conversations/${conversationId}/messages?before=${messages[0]._id}`);
      keepOffset.current = scrollRef.current ? scrollRef.current.scrollHeight - scrollRef.current.scrollTop : null;
      setMessages((list) => [...page.messages.filter((message) => !list.some((item) => item._id === message._id)), ...list]);
      setHasMore(page.hasMore);
    } catch {
      keepOffset.current = null;
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = (body) =>
    new Promise((resolve, reject) => {
      getSocket()
        .timeout(SEND_TIMEOUT_MS)
        .emit('chat:send', {conversationId, body}, (timedOut, reply) => {
          if (timedOut) return reject(new Error('The message did not send. Check your connection and try again.'));
          if (reply?.error) return reject(new Error(reply.error));
          setMessages((list) => addMessages(list, [reply.message]));
          resolve();
        });
    });

  if (error) {
    return (
      <div className={styles.placeholder} role='alert'>
        <p>{error.status === 404 ? 'This conversation does not exist or is not yours.' : error.message}</p>
        <Link href={ROUTES.inbox} className='btn btn-quiet'>
          Back to inbox
        </Link>
      </div>
    );
  }

  if (!conversation) return <p className={styles.status}>Loading conversation...</p>;

  return (
    <div className={styles.thread}>
      <ThreadHeader conversation={conversation} />
      <Messages
        messages={messages}
        meId={meId}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
        scrollRef={scrollRef}
      />
      <Composer onSend={send} />
    </div>
  );
}
