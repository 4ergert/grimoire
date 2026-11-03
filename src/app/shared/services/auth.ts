import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDJTN1L2sANKl2yMkLLbrf6OixiFzZncHM',
  authDomain: 'grimoire-base.firebaseapp.com',
  databaseURL: 'https://grimoire-base-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'grimoire-base',
  storageBucket: 'grimoire-base.firebasestorage.app',
  messagingSenderId: '293037921304',
  appId: '1:293037921304:web:1c799f2fb6433350fe5f6d',
};

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly app = initializeApp(firebaseConfig);
  private readonly auth = getAuth(this.app);
  private readonly database = getDatabase(this.app);
  private readonly currentUser = signal<User | null>(null);
  readonly user = this.currentUser.asReadonly();

  constructor() {
    const unsubscribe = onAuthStateChanged(this.auth, (user) => this.currentUser.set(user));
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(username: string, email: string, password: string): Promise<void> {
    const { user } = await createUserWithEmailAndPassword(this.auth, email, password);

    try {
      await updateProfile(user, { displayName: username });
      await set(ref(this.database, `users/${user.uid}`), { username });
    } catch (error) {
      try {
        await deleteUser(user);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'The account was created, but the profile could not be saved or the account removed. Please contact support.',
        );
      }
      throw error;
    }

    this.currentUser.set(user);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
