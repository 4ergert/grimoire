import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectDatabaseEmulator, get, getDatabase, ref, set, update } from 'firebase/database';

const apps = [];
function database(uid) {
  const app = initializeApp({
    projectId: 'demo-grimoire',
    databaseURL: 'https://demo-grimoire-default-rtdb.firebaseio.com',
  }, uid || 'guest');
  apps.push(app);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 19000, uid
    ? { mockUserToken: { sub: uid, user_id: uid } }
    : {});
  return db;
}

async function denied(promise) {
  await assert.rejects(promise, /permission[ _]denied/i);
}

try {
  const first = database('first');
  const second = database('second');
  const guest = database();
  await denied(get(ref(guest, 'usernames/julian')));
  const register = (db, uid, name) => update(ref(db), {
    [`users/${uid}`]: { username: name },
    [`usernames/${name.toLowerCase()}`]: uid,
  });
  const results = await Promise.allSettled([
    register(first, 'first', 'Julian'),
    register(second, 'second', 'jULIAN'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const winner = results[0].status === 'fulfilled' ? first : second;
  const uid = results[0].status === 'fulfilled' ? 'first' : 'second';
  const loser = uid === 'first' ? second : first;
  const loserUid = uid === 'first' ? 'second' : 'first';
  assert.equal((await get(ref(winner, 'usernames/julian'))).val(), uid);
  assert.equal((await get(ref(winner, `users/${uid}/username`))).val().toLowerCase(), 'julian');
  await denied(get(ref(loser, `users/${uid}`)));
  await denied(get(ref(winner, 'usernames')));
  await denied(set(ref(winner, 'usernames/julian'), null));
  await denied(set(ref(winner, `users/${uid}`), null));
  await denied(set(ref(winner, `users/${uid}/username`), 'Impostor'));
  await denied(set(ref(loser, 'usernames/julian'), loserUid));
  await denied(update(ref(loser), {
    [`users/${loserUid}`]: { username: 'Julian' },
    'usernames/other': loserUid,
  }));
  await denied(register(loser, loserUid, 'Bad-Name'));
  await denied(register(loser, loserUid, 'abc'));
  await denied(register(loser, loserUid, 'a'.repeat(43)));
  await denied(update(ref(loser), {
    [`users/${loserUid}`]: { username: 'FakeOwner' },
    'usernames/fakeowner': uid,
  }));
  await update(ref(winner), { [`users/${uid}`]: null, 'usernames/julian': null });
  await register(loser, loserUid, 'JULIAN');
  await update(ref(loser), { [`users/${loserUid}`]: null, 'usernames/julian': null });
  await register(winner, uid, 'Abc1');
  await update(ref(winner), { [`users/${uid}`]: null, 'usernames/abc1': null });
  await register(winner, uid, 'Kai Sloot');
  await denied(register(loser, loserUid, 'kAI sLOOT'));
  await denied(register(loser, loserUid, 'Bad  Name'));
  await denied(register(loser, loserUid, ' Bad Name'));
  await denied(register(loser, loserUid, 'Bad Name '));
  await update(ref(winner), { [`users/${uid}`]: null, 'usernames/kai sloot': null });
  await register(winner, uid, 'A'.repeat(42));
  console.log('Username rules: concurrency, ownership, normalization, validation, and reuse passed.');
} finally {
  await Promise.all(apps.map(deleteApp));
}
