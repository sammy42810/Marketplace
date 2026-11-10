import {ObjectId} from 'mongodb';
import {HttpError} from './auth.js';
import {getAdminAuth} from './firebaseAdmin.js';
import {getDb} from './mongo.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const MAX_NAME = 50;

// What anyone can see about a user. Email and Firebase uid stay private.
function publicProfile(user) {
  return {
    _id: user._id.toString(),
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt
  };
}

export async function getProfile(id) {
  if (!OBJECT_ID.test(id)) throw new HttpError(404, 'User not found.');
  const db = await getDb();
  const user = await db
    .collection('users')
    .findOne({_id: new ObjectId(id)}, {projection: {displayName: 1, photoUrl: 1, createdAt: 1}});
  if (!user) throw new HttpError(404, 'User not found.');
  return publicProfile(user);
}

export async function updateProfile(user, body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Send a JSON object.');
  const unknown = Object.keys(body).find((field) => field !== 'displayName');
  if (unknown) throw new HttpError(400, `"${unknown}" cannot be changed.`);

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (!displayName) throw new HttpError(400, 'Display name is required.');
  if (displayName.length > MAX_NAME) throw new HttpError(400, `Display name must be ${MAX_NAME} characters or fewer.`);

  // The header reads the name from Firebase. It goes first: it's the call more likely to fail,
  // and failing before MongoDB changes leaves both names as they were.
  await getAdminAuth().updateUser(user.firebaseUid, {displayName});
  const db = await getDb();
  const updated = await db
    .collection('users')
    .findOneAndUpdate({_id: user._id}, {$set: {displayName, updatedAt: new Date()}}, {returnDocument: 'after'});
  return publicProfile(updated);
}
