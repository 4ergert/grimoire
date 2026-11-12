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
import { get, getDatabase, onValue, ref, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDJTN1L2sANKl2yMkLLbrf6OixiFzZncHM',
  authDomain: 'grimoire-base.firebaseapp.com',
  databaseURL: 'https://grimoire-base-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'grimoire-base',
  storageBucket: 'grimoire-base.firebasestorage.app',
  messagingSenderId: '293037921304',
  appId: '1:293037921304:web:1c799f2fb6433350fe5f6d',
};

const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 42;
const USERNAME_PATTERN = /^[A-Za-z0-9_]+(?: [A-Za-z0-9_]+)*$/;

export class UsernameTakenError extends Error {
  constructor() {
    super('This name is already in use.');
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly app = initializeApp(firebaseConfig);
  private readonly auth = getAuth(this.app);
  readonly database = getDatabase(this.app);
  private readonly currentUser = signal<User | null>(null, { equal: () => false });
  readonly user = this.currentUser.asReadonly();
  private readonly verified = signal(false);
  readonly emailVerified = this.verified.asReadonly();
  private readonly profileName = signal<string | null>(null);
  readonly username = this.profileName.asReadonly();
  private readonly profileReadError = signal(false);
  readonly usernameUnavailable = this.profileReadError.asReadonly();

  constructor() {
    let unsubscribeProfile: (() => void) | undefined;
    const unsubscribe = onAuthStateChanged(this.auth, (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      this.profileName.set(null);
      this.profileReadError.set(false);
      this.verified.set(user?.emailVerified === true);
      this.currentUser.set(user);
      if (user) {
        unsubscribeProfile = onValue(ref(this.database, `users/${user.uid}/username`), (snapshot) => {
          const value: unknown = snapshot.val();
          this.profileName.set(typeof value === 'string' ? value : null);
          this.profileReadError.set(false);
        }, (error) => {
          console.error('Username could not be loaded', error);
          this.profileReadError.set(true);
        });
      }
    });
    inject(DestroyRef).onDestroy(() => {
      unsubscribeProfile?.();
      unsubscribe();
    });
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(username: string, email: string, password: string): Promise<void> {
    const normalizedUsername = username.trim().replace(/\s+/g, ' ');
    if (
      normalizedUsername.length < MIN_USERNAME_LENGTH
      || normalizedUsername.length > MAX_USERNAME_LENGTH
      || !USERNAME_PATTERN.test(normalizedUsername)
    ) {
      throw new Error(
        'Names must contain 4 to 42 letters, numbers, underscores, and single spaces between words.',
      );
    }
    const key = normalizedUsername.toLowerCase();
    const { user } = await createUserWithEmailAndPassword(this.auth, email, password);

    try {
      await updateProfile(user, { displayName: normalizedUsername });
      await update(ref(this.database), {
        [`users/${user.uid}`]: { username: normalizedUsername },
        [`usernames/${key}`]: user.uid,
      });
    } catch (error) {
      try {
        const [profile, reservation] = await Promise.all([
          get(ref(this.database, `users/${user.uid}`)),
          get(ref(this.database, `usernames/${key}`)),
        ]);
        if (profile.exists()) {
          if (profile.child('username').val() !== normalizedUsername || reservation.val() !== user.uid) {
            throw new Error('The saved profile and username reservation do not match.');
          }
          await update(ref(this.database), {
            [`users/${user.uid}`]: null,
            [`usernames/${key}`]: null,
          });
        } else if (reservation.val() === user.uid) {
          throw new Error('The username reservation exists without its profile.');
        }
        await deleteUser(user);
        if (reservation.exists() && reservation.val() !== user.uid) throw new UsernameTakenError();
      } catch (rollbackError) {
        if (rollbackError instanceof UsernameTakenError) throw rollbackError;
        throw new AggregateError(
          [error, rollbackError],
          'Registration failed and the new account could not be fully removed. Please sign in to delete it or contact support.',
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
    const profile = await get(ref(this.database, `users/${user.uid}`));
    const changes: Record<string, null> = {
      [`gameLibrary/${user.uid}`]: null,
    };
    if (profile.exists()) {
      const username: unknown = profile.child('username').val();
      if (
        typeof username !== 'string'
        || username.length < MIN_USERNAME_LENGTH
        || username.length > MAX_USERNAME_LENGTH
        || !USERNAME_PATTERN.test(username)
      ) {
        throw new Error('The username must be migrated before this account can be deleted. Please contact support.');
      }
      changes[`users/${user.uid}`] = null;
      changes[`usernames/${username.toLowerCase()}`] = null;
    }
    await update(ref(this.database), changes);
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
