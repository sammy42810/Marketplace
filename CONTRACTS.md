
# Marketplace API Contracts

**Jira:** KAN-21 (schemas), KAN-30 (API routes)

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

**Notifications**
- _id: ObjectId
- userId: ObjectId
- type, message: String
- listingId: ObjectId or null
- read: Boolean
- createdAt: Date

## 2. API Routes

The following routes are either already implemented or planned for future development.

### Existing Routes

| Method | Route | Auth | Response |
| --- | --- | --- | --- |
| GET | /api/health | No | Service health information |
| GET | /api/me | Signed in | {user} |

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

### Offers and Bids (Planned)

| Method | Route | Auth | Request / Response |
| --- | --- | --- | --- |
| POST | /api/listings/:id/offers | Yes | {amount} -> {offer} |
| GET | /api/listings/:id/offers | Seller | -> {offers} |
| PATCH | /api/offers/:id | Authorized user | {status} -> {offer} |
| POST | /api/listings/:id/bids | Yes | {amount} -> {bid, currentBid} |
| GET | /api/listings/:id/bids | No | -> {bids} |

### Messages, Reviews, Notifications (Planned)

| Method | Route | Auth | Request / Response |
| --- | --- | --- | --- |
| GET | /api/messages | Yes | -> {messages} |
| POST | /api/messages | Yes | {recipientId, listingId, body} -> {message} |
| GET | /api/users/:id/reviews | No | -> {reviews} |
| POST | /api/reviews | Yes | {listingId, revieweeId, rating, comment} -> {review} |
| GET | /api/notifications | Yes | -> {notifications} |
| PATCH | /api/notifications/:id | Owner | {read: true} -> {notification} |

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

Sockets use Firebase authentication. The client sends `{token}` (a Firebase ID token) in the handshake `auth` payload. Connections with a missing or invalid token are rejected with a `connect_error` whose message is `unauthorized`. The existing server creates a `user:<firebaseUid>` room for each connected user.

| Event | Direction | Data | Status |
| --- | --- | --- | --- |
| clock | Server -> Socket, on connect | {serverTime} (ms since epoch) | Existing |
| ping | Client -> Server | Acknowledgement -> {serverTime} | Existing |
| auction:join | Client -> Server | {listingId} | Planned |
| auction:leave | Client -> Server | {listingId} | Planned |
| auction:bid | Server -> Auction room | {listingId, amount, bidderId} | Planned |
| outbid | Server -> User | {listingId, amount} | Planned |
| message:new | Server -> User | {message} | Planned |
| notification:new | Server -> User | {notification} | Planned |

Auction rooms are named `auction:<listingId>`.