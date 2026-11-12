import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  User,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { getDatabase, ref, set, update } from 'firebase/database';

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
  readonly database = getDatabase(this.app);
  private readonly currentUser = signal<User | null>(null, { equal: () => false });
  readonly user = this.currentUser.asReadonly();
  private readonly verified = signal(false);
  readonly emailVerified = this.verified.asReadonly();

  constructor() {
    const unsubscribe = onAuthStateChanged(this.auth, (user) => {
      this.verified.set(user?.emailVerified === true);
      this.currentUser.set(user);
    });
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
    this.verified.set(user.emailVerified === true);
    try {
      await this.sendVerificationEmail();
    } catch (error) {
      throw new AggregateError(
        [error],
        'Your account was created, but the verification email could not be sent. Please try sending it again.',
      );
    }
  }

  async sendVerificationEmail(): Promise<void> {
    const user = this.user();
    if (!user) throw new Error('Please sign in to request a verification email.');
    if (user.emailVerified) throw new Error('Your email address is already verified.');
    this.auth.languageCode = 'en';
    await sendEmailVerification(user, {
      url: 'https://grimoire.julian-hergert.de/',
    });
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async refreshVerification(): Promise<boolean> {
    const user = this.user();
    if (!user) throw new Error('Please sign in to check your email verification.');
    await reload(user);
    await user.getIdToken(true);
    if (this.user() !== user) throw new Error('Your session changed. Please sign in again.');
    this.verified.set(user.emailVerified);
    this.currentUser.set(user);
    return user.emailVerified;
  }

  async deleteAccount(password: string): Promise<void> {
    const user = this.user();
    if (!user?.email || !password) {
      throw new Error('Please sign in and enter your current password to delete your account.');
    }
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password),
    );
    await update(ref(this.database), {
      [`users/${user.uid}`]: null,
      [`gameLibrary/${user.uid}`]: null,
    });
    try {
      await deleteUser(user);
    } catch (error) {
      throw new AggregateError(
        [error],
        'Your profile and saved games were deleted, but your sign-in account could not be deleted. Please retry account deletion or contact support.',
      );
    }
    this.currentUser.set(null);
    this.verified.set(false);
  }
}
