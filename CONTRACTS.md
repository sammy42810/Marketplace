
# Marketplace API Contracts

**Jira:** KAN-21 (schemas), KAN-30 (API routes), KAN-27 (notification format)

**Status:** Draft

## 1. Database Schemas

### Users (Existing)

| Field | Type |
| --- | --- |
| _id | ObjectId |
| firebaseUid | String (unique) |
| email | String |
| displayName | String |
| photoUrl | String |
| emailVerified | Boolean |
| createdAt, updatedAt | Date |

### Listings (Existing)

| Field | Type |
| --- | --- |
| _id | ObjectId |
| sellerId | ObjectId |
| title | String |
| description | String |
| category | String |
| condition | String |
| price | Number |
| saleType | String (offer/auction) |
| photos | Array of {thumb, card, full} URLs |
| zip | String |
| location | GeoJSON Point |
| status | String (active/sold/removed) |
| startsAt, endsAt | Date or null |
| minIncrement | Number or null |
| currentBid | Number or null |
| currentBidder | ObjectId or null |
| buyerId | ObjectId, only once sold through an offer |
| soldPrice | Number, only once sold through an offer |
| soldAt | Date, only once sold through an offer |
| createdAt, updatedAt | Date |

The `location` field uses GeoJSON coordinates `[longitude, latitude]` and a 2dsphere index for nearby searches.

### Other Collections (Planned)

**Offers**
- _id: ObjectId
- listingId, buyerId: ObjectId
- amount: Number
- status: pending/accepted/rejected/cancelled
- createdAt, updatedAt: Date

**Bids**
- _id: ObjectId
- listingId, bidderId: ObjectId
- amount: Number
- createdAt: Date

**Messages**
- _id: ObjectId
- senderId, recipientId: ObjectId
- conversationId: String
- listingId: ObjectId or null
- body: String
- readAt: Date or null
- createdAt: Date

**Reviews**
- _id: ObjectId
- listingId, reviewerId, revieweeId: ObjectId
- rating: Number (1-5)
- comment: String
- createdAt: Date

**Notifications** (format agreed; see [section 4](#4-notifications))
- _id: ObjectId
- userId: ObjectId (recipient)
- type: String (one of the nine types in section 4)
- listingId: ObjectId or null
- actorId: ObjectId or null
- message: String
- read: Boolean
- createdAt: Date

## 2. API Routes

The following routes are either already implemented or planned for future development.

### Existing Routes

| Method | Route | Auth | Response |
| --- | --- | --- | --- |
| GET | /api/health | No | Service health information |
| GET | /api/me | Signed in | {user} |
| PATCH | /api/me | Signed in, verified | {displayName} -> {user} (public fields) |
| GET | /api/users/:id | No | -> {user: {_id, displayName, photoUrl, createdAt}} |

`PATCH /api/me` only changes `displayName`: a string of 1 to 50 characters after trimming. Any other field is a 400. It also updates the name in Firebase so the header matches. `GET /api/users/:id` never returns the email or Firebase uid; a malformed or unknown id is a 404.

The profile page is `/users/:id` (MongoDB `_id`). `/users/me` redirects the signed-in user to their own profile.

### Listings (Existing)

| Method | Route | Auth | Request / Response |
| --- | --- | --- | --- |
| GET | /api/listings | No | Query filters -> {listings, page, limit, total} |
| POST | /api/listings | Yes | Listing fields -> {listing} |
| GET | /api/listings/:id | No | -> {listing}, with `seller: {_id, displayName, photoUrl}` |
| PATCH | /api/listings/:id | Owner | Updated fields -> {listing} |
| DELETE | /api/listings/:id | Owner | -> {ok: true} |

DELETE marks the listing as removed, and removed listings return 404.

**Browse filters:** `page`, `limit` (default 24, max 50), `category`, `condition`, `saleType`, `seller` (user `_id`), `minPrice`, `maxPrice`, `sort` (`newest`, `price_asc`, `price_desc`). Only active listings are returned.

**Allowed values:** `category` is electronics, furniture, textbooks, clothing, tickets, sports, home or other. `condition` is new, like-new, good, fair or poor.

**Required on create:** title, description, category, condition, price, saleType, zip. Auctions also need `endsAt` and `minIncrement`; `startsAt` defaults to now, and an auction runs from 1 minute to 30 days. `photos` must be same-site paths. `location` is optional.

**PATCH** can change title, description, category, condition, price, photos, zip and location. Any other field is a 400. Listings that have sold or have bids can't be edited or removed (409).

**Errors** are `{error: message}`: 400 invalid input, 401 not signed in, 403 not the seller or email unverified, 404 not found or malformed ID, 409 locked.

### Offers and Bids (Existing)

| Method | Route | Auth | Request / Response |
| --- | --- | --- | --- |
| POST | /api/listings/:id/offers | Yes | {amount} -> {offer} |
| GET | /api/listings/:id/offers | Yes | -> {offers} |
| PATCH | /api/offers/:id | Seller or buyer | {status} -> {offer} |
| POST | /api/listings/:id/bids | Yes | {amount} -> {bid, currentBid} |
| GET | /api/listings/:id/bids | No | -> {bids} |

Offers only work on active `saleType: offer` listings, and a seller can't offer on their own. A buyer has at most one pending offer per listing (a second is a 409 until they cancel the first).

`GET /api/listings/:id/offers` gives the seller every offer, newest first, each with `buyer: {_id, displayName, photoUrl}`. Anyone else gets only their own offers on that listing.

`PATCH /api/offers/:id` only changes a pending offer. The seller sends `accepted` or `rejected`; the buyer sends `cancelled`. Accepting runs in one transaction: the listing becomes `sold` with `buyerId`, `soldPrice` and `soldAt`, and every other pending offer becomes `rejected`. Notifications: `offer_received` to the seller on a new offer, `offer_accepted` or `offer_declined` to the buyer, and `listing_sold` to the other buyers whose pending offers were closed by the sale.

### Messages, Reviews, Notifications (Planned)

| Method | Route | Auth | Request / Response |
| --- | --- | --- | --- |
| GET | /api/messages | Yes | -> {messages} |
| POST | /api/messages | Yes | {recipientId, listingId, body} -> {message} |
| GET | /api/users/:id/reviews | No | -> {reviews} |
| POST | /api/reviews | Yes | {listingId, revieweeId, rating, comment} -> {review} |
| GET | /api/notifications | Yes | -> {notifications} |
| PATCH | /api/notifications/:id | Owner | {read: true} -> {notification} |
| POST | /api/notifications/read-all | Yes | -> {updated} (count marked read) |

### Example: Create Listing

POST /api/listings

Authentication: Firebase ID token required

Request:
```json
{
  "title": "Used bicycle",
  "description": "Good condition",
  "category": "sports",
  "condition": "good",
  "price": 100,
  "saleType": "offer",
  "photos": [],
  "zip": "07030",
  "location": {
    "type": "Point",
    "coordinates": [-74.03, 40.74]
  }
}
```

Response: HTTP 201

```json
{
  "listing": {
    "_id": "generated-id",
    "title": "Used bicycle",
    "price": 100,
    "status": "active"
  }
}
```

## 3. Socket.IO Events

Sockets use Firebase authentication. The client sends `{token}` (a Firebase ID token) in the handshake `auth` payload. Connections with a missing or invalid token are rejected with a `connect_error` whose message is `unauthorized` (or `server_error` if the user record can't be loaded). Each connected socket joins a `user:<userId>` room, where `userId` is the user's `users._id` (the same id as `/api/me`'s `user.id`), so every tab the user has open gets their events. Server code sends to it with `emitToUser(userId, event, data)` from `src/lib/server/realtime.js`.

| Event | Direction | Data | Status |
| --- | --- | --- | --- |
| clock | Server -> Socket, on connect | {serverTime} (ms since epoch) | Existing |
| ping | Client -> Server | Acknowledgement -> {serverTime} | Existing |
| auction:join | Client -> Server | {listingId} | Planned |
| auction:leave | Client -> Server | {listingId} | Planned |
| auction:bid | Server -> Auction room | {listingId, amount, bidderId} | Planned |
| message:new | Server -> User | {message} | Planned |
| notification:new | Server -> User | {notification}, see section 4 | Proposed; sender in place |

Auction rooms are named `auction:<listingId>`. Being outbid has no event of its own: the bidder gets a `notification:new` of type `outbid`, and the auction room's `auction:bid` carries the live price.

## 4. Notifications

**Status:** Proposed, waiting for roles D and E to sign off (see [Sign-off](#sign-off) at the end of this section).

One format is used for the MongoDB document, `GET /api/notifications`, and the `notification:new` socket event.

### Fields

| Field | Stored as | Sent as | Notes |
| --- | --- | --- | --- |
| _id | ObjectId | String | |
| userId | ObjectId | String | Recipient, a `users._id` |
| type | String | String | One of the types below |
| listingId | ObjectId or null | String or null | The listing it is about. Null only for a `new_message` with no listing |
| actorId | ObjectId or null | String or null | The user who caused it. Null for system events (auction end) |
| message | String | String | Plain text written by the server, at most 280 characters. Clients show it as text, never as HTML |
| read | Boolean | Boolean | `false` when created |
| createdAt | Date | ISO 8601 string | |

User references are `users._id`, never Firebase UIDs, the same as `sellerId`, `buyerId` and `bidderId`. Clients link to the listing from `listingId`, and look up the actor's name through the user APIs if they need more than the message.

### Types

| Type | Sent to | actorId | When |
| --- | --- | --- | --- |
| offer_received | Seller | Buyer | A buyer makes an offer |
| offer_accepted | Buyer | Seller | The seller accepts the offer |
| offer_declined | Buyer | Seller | The seller declines the offer (offer status `rejected`) |
| outbid | Previous high bidder | New high bidder | Someone places a higher bid |
| auction_won | Winning bidder | null | An auction ends with bids |
| auction_ended | Seller | null | An auction ends, with or without bids |
| price_drop | Everyone watching the listing (KAN-37) | Seller | The seller lowers the price |
| listing_sold | Other buyers with a pending offer | null | The listing sells to someone else |
| new_message | Message recipient | Sender | A chat message arrives |

Example messages: `Alex offered $80 on "Used bicycle"`, `You were outbid on "Desk lamp": the bid is now $25`, `"Desk lamp" sold for $30`.

### Rules

1. **Save, then emit.** The server inserts the document into MongoDB first, then emits `notification:new` with `{notification}` to `user:<userId>`. If the insert fails, nothing is emitted. If the user is offline, nothing is lost: they get it from `GET /api/notifications`.
2. **One helper.** Features create notifications only through `createNotification({userId, type, listingId, actorId, message})` in `src/lib/server/notifications.js`. It checks the type and ids, trims `message` (long chat previews are shortened to 280 characters), saves, emits, and returns the notification as sent.
3. **No self-notifications.** If `actorId` equals `userId`, nothing is stored or sent and the helper returns null.
4. **Read state.** Only the recipient can change a notification, and only `read` to `true`: one at a time (`PATCH /api/notifications/:id`) or all at once (`POST /api/notifications/read-all`). Notifications are never edited otherwise.
5. **Order.** Newest first (`createdAt`, then `_id`, descending). Indexed on `{userId, createdAt, _id}`.
6. **Chat.** A chat message sends both `message:new` (the full message, for an open chat) and a `new_message` notification (for the bell).

### Example socket payload

```json
{
  "notification": {
    "_id": "6650f1c2a9e4b1d2c3f4a5b6",
    "userId": "6650e0a1a9e4b1d2c3f4a001",
    "type": "offer_received",
    "listingId": "6650e9b7a9e4b1d2c3f4a100",
    "actorId": "6650e0a1a9e4b1d2c3f4a002",
    "message": "Alex offered $80 on \"Used bicycle\"",
    "read": false,
    "createdAt": "2026-11-09T18:30:00.000Z"
  }
}
```

### Sign-off

These points differ from, or go beyond, the KAN-27 ticket text. Roles D and E confirm them (or ask for changes), then this section's status changes to **Agreed**.

- [ ] The ticket's "recipient uid" and "actor uid" are `userId` and `actorId`, holding `users._id`, not Firebase UIDs. Socket rooms are `user:<users._id>`.
- [ ] The ticket's "message text" is the `message` field, written by the server.
- [ ] Recipients per type, as in the Types table. In particular: `auction_ended` goes to the seller only, and `listing_sold` goes to other buyers with a pending offer.
- [ ] Being outbid is a `notification:new` of type `outbid`, with no separate `outbid` event.
- [ ] Mark-all-read is `POST /api/notifications/read-all`.

| Role | Name | Agreed on |
| --- | --- | --- |
| D | | |
| E | | |