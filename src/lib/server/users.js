import {getDb} from './mongo.js';

async function usersCollection() {
  const users = (await getDb()).collection('users');
  if (!globalThis.marketplaceUserIndexes) {
    globalThis.marketplaceUserIndexes = users.createIndex({firebaseUid: 1}, {unique: true});
  }
  await globalThis.marketplaceUserIndexes;
  return users;
}

export async function findOrCreateUser(token) {
  const users = await usersCollection();
  const email = token.email ?? null;
  const emailVerified = token.email_verified === true;

  const existing = await users.findOne({firebaseUid: token.uid});
  if (existing) {
    if (existing.email === email && existing.emailVerified === emailVerified) return existing;
    return users.findOneAndUpdate(
      {_id: existing._id},
      {$set: {email, emailVerified, updatedAt: new Date()}},
      {returnDocument: 'after'}
    );
  }

  const now = new Date();
  // Upsert, so two first requests at once still create one user.
  return users.findOneAndUpdate(
    {firebaseUid: token.uid},
    {
      $setOnInsert: {
        firebaseUid: token.uid,
        email,
        emailVerified,
        displayName: token.name ?? null,
        photoUrl: token.picture ?? null,
        createdAt: now,
        updatedAt: now
      }
    },
    {upsert: true, returnDocument: 'after'}
  );
}

// The fields that are safe to send to the browser.
export function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt
  };
}
