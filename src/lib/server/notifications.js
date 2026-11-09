// The notification format agreed in CONTRACTS.md section 4. Every feature that notifies a user
// goes through createNotification, so the stored document and the socket payload always match.
import {ObjectId} from 'mongodb';
import {getDb} from './mongo.js';
import {emitToUser} from './realtime.js';

export const NOTIFICATION_TYPES = [
  'offer_received',
  'offer_accepted',
  'offer_declined',
  'outbid',
  'auction_won',
  'auction_ended',
  'price_drop',
  'listing_sold',
  'new_message'
];

export const MAX_NOTIFICATION_MESSAGE = 280;

async function notificationsCollection() {
  const notifications = (await getDb()).collection('notifications');
  if (!globalThis.marketplaceNotificationIndexes) {
    globalThis.marketplaceNotificationIndexes = notifications
      .createIndex({userId: 1, createdAt: -1, _id: -1})
      .catch((error) => {
        globalThis.marketplaceNotificationIndexes = null;
        throw error;
      });
  }
  await globalThis.marketplaceNotificationIndexes;
  return notifications;
}

// Callers pass ids from our own documents, so a bad one is a bug, not a 400.
function objectId(value, label) {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value) && value.length === 24) return new ObjectId(value);
  throw new TypeError(`createNotification: ${label} must be an ObjectId.`);
}

function messageText(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('createNotification: message is required.');
  const trimmed = value.trim().replace(/\s+/g, ' ');
  // new_message previews come from user text, so shorten rather than reject.
  return trimmed.length > MAX_NOTIFICATION_MESSAGE ? `${trimmed.slice(0, MAX_NOTIFICATION_MESSAGE - 1)}…` : trimmed;
}

// The JSON shape sent by GET /api/notifications and the `notification:new` socket event.
export function publicNotification(doc) {
  return {
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    type: doc.type,
    listingId: doc.listingId?.toString() ?? null,
    actorId: doc.actorId?.toString() ?? null,
    message: doc.message,
    read: doc.read,
    createdAt: doc.createdAt
  };
}

/**
 * Saves a notification, then pushes it to the recipient's open tabs.
 * Returns the public notification, or null when the recipient is the actor (nobody is told about
 * their own action). If the insert fails it throws and nothing is emitted.
 *
 * @param {object} input
 * @param {ObjectId|string} input.userId     recipient (users._id)
 * @param {string} input.type                one of NOTIFICATION_TYPES
 * @param {ObjectId|string|null} [input.listingId]
 * @param {ObjectId|string|null} [input.actorId]  user who caused it; null for system events
 * @param {string} input.message             plain text shown to the recipient
 */
export async function createNotification({userId, type, listingId = null, actorId = null, message}) {
  if (!NOTIFICATION_TYPES.includes(type)) throw new TypeError(`createNotification: unknown type "${type}".`);
  const doc = {
    userId: objectId(userId, 'userId'),
    type,
    listingId: listingId === null ? null : objectId(listingId, 'listingId'),
    actorId: actorId === null ? null : objectId(actorId, 'actorId'),
    message: messageText(message),
    read: false,
    createdAt: new Date()
  };
  if (doc.actorId?.equals(doc.userId)) return null;

  const {insertedId} = await (await notificationsCollection()).insertOne(doc);
  const notification = publicNotification({...doc, _id: insertedId});
  emitToUser(doc.userId, 'notification:new', {notification});
  return notification;
}
