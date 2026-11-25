import {ROUTES} from './routes';

export const NOTIFICATION_KINDS = {
  offer_received: {label: 'New offer', tone: 'offer'},
  offer_accepted: {label: 'Offer accepted', tone: 'good', toast: true},
  offer_declined: {label: 'Offer declined', tone: 'muted'},
  outbid: {label: 'Outbid', tone: 'live', toast: true},
  auction_won: {label: 'Auction won', tone: 'win', toast: true},
  auction_ended: {label: 'Auction ended', tone: 'muted'},
  price_drop: {label: 'Price drop', tone: 'offer'},
  listing_sold: {label: 'Sold', tone: 'muted'},
  new_message: {label: 'Message', tone: 'message'}
};

export function notificationKind(type) {
  return NOTIFICATION_KINDS[type] ?? {label: 'Update', tone: 'muted'};
}

export function notificationHref(notification) {
  if (notification.type === 'new_message') return ROUTES.inbox;
  if (notification.listingId) return ROUTES.listing(notification.listingId);
  return ROUTES.notifications;
}
