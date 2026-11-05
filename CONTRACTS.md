
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

### Listings (Planned)

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

### Listings (Planned)

| Method | Route | Auth | Request / Response |
| --- | --- | --- | --- |
| GET | /api/listings | No | Query filters -> {listings, page, total} |
| POST | /api/listings | Yes | Listing fields -> {listing} |
| GET | /api/listings/:id | No | -> {listing} |
| PATCH | /api/listings/:id | Owner | Updated fields -> {listing} |
| DELETE | /api/listings/:id | Owner | -> {ok: true} |

DELETE marks the listing as removed.

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

Sockets use Firebase authentication. The existing server creates a `user:<firebaseUid>` room for each connected user.

| Event | Direction | Data | Status |
| --- | --- | --- | --- |
| ping | Client -> Server | Acknowledgement | Existing |
| auction:join | Client -> Server | {listingId} | Planned |
| auction:leave | Client -> Server | {listingId} | Planned |
| auction:bid | Server -> Auction room | {listingId, amount, bidderId} | Planned |
| outbid | Server -> User | {listingId, amount} | Planned |
| message:new | Server -> User | {message} | Planned |
| notification:new | Server -> User | {notification} | Planned |

Auction rooms are named `auction:<listingId>`.

## 4. Auction Bidding Rules

For KAN-50, placing a bid should:

1. Check that the auction is active and has not ended.
2. Check that the bidder is not the seller.
3. Check that the amount meets the required minimum bid.
4. Atomically update the current highest bid using MongoDB.
5. Save the bid in the Bids collection.
6. Notify the auction room and previous highest bidder.

An atomic update prevents two competing bids from both becoming the highest bid. Bid history and notifications should stay consistent with the accepted result.