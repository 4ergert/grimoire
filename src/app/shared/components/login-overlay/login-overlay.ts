import { Component, inject, signal } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { MenuOverlay } from '../menu-overlay/menu-overlay';
import { PlayGround } from '../play-ground/play-ground';
import { GameLibrary } from '../game-library/game-library';
import { GameFolder } from '../../services/game-library';
import { CustomButton } from '../button/button';

@Component({
  selector: 'login-overlay',
  imports: [MenuOverlay, PlayGround, GameLibrary, RouterLink, CustomButton],
  templateUrl: './login-overlay.html',
  styleUrl: './login-overlay.scss',
})
export class LoginOverlay {
  readonly auth = inject(Auth);
  readonly isSignUp = signal(false);
  readonly isPlaying = signal(false);
  readonly guest = signal(false);
  readonly computerGame = signal(false);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly libraryOpen = signal(false);
  readonly savePgn = signal('');
  readonly replayPgn = signal('');
  readonly trainingFolder = signal<GameFolder | null>(null);

  startGuest(): void {
    this.error.set('');
    this.guest.set(true);
  }

  leaveGuest(): void {
    this.guest.set(false);
  }

  startTraining(folder: GameFolder): void {
    this.computerGame.set(false);
    this.trainingFolder.set(folder);
    this.replayPgn.set('');
    this.isPlaying.set(true);
    this.libraryOpen.set(false);
  }

  returnToMenu(): void {
    this.computerGame.set(false);
    this.isPlaying.set(false);
    this.replayPgn.set('');
    this.trainingFolder.set(null);
  }

  openLibrary(pgn = ''): void {
    this.savePgn.set(pgn);
    this.libraryOpen.set(true);
  }

  openReplay(pgn: string): void {
    this.computerGame.set(false);
    this.trainingFolder.set(null);
    this.replayPgn.set(pgn);
    this.isPlaying.set(true);
    this.libraryOpen.set(false);
  }

  startPlaying(computer = false): void {
    this.computerGame.set(computer);
    this.trainingFolder.set(null);
    this.replayPgn.set('');
    this.isPlaying.set(true);
  }

  switchAuthMode(form: HTMLFormElement): void {
    form.reset();
    this.error.set('');
    this.isSignUp.update((value) => !value);
  }

  async submit(event: Event, form: HTMLFormElement): Promise<void> {
    event.preventDefault();
    if (this.pending() || !form.reportValidity()) {
      return;
    }

    this.error.set('');
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const username = String(data.get('name') ?? '').trim();

    if (this.isSignUp() && !username) {
      this.error.set('Please enter a name.');
      return;
    }
    if (this.isSignUp() && password !== data.get('confirm-password')) {
      this.error.set('The passwords do not match.');
      return;
    }

    this.pending.set(true);
    try {
      if (this.isSignUp()) {
        await this.auth.register(username, email, password);
      } else {
        await this.auth.login(email, password);
      }
      form.reset();
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.pending.set(false);
    }
  }

  async logout(): Promise<void> {
    this.error.set('');
    this.pending.set(true);
    try {
      await this.auth.logout();
      this.computerGame.set(false);
      this.isPlaying.set(false);
      this.libraryOpen.set(false);
      this.savePgn.set('');
      this.replayPgn.set('');
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.pending.set(false);
    }
  }

  async deleteAccount(password: string): Promise<void> {
    if (this.pending()) return;
    this.error.set('');
    this.pending.set(true);
    try {
      await this.auth.deleteAccount(password);
      this.returnToMenu();
      this.libraryOpen.set(false);
      this.savePgn.set('');
      this.guest.set(false);
      this.isSignUp.set(false);
    } catch (error) {
      console.error('Account deletion failed', error);
      this.error.set(
        error instanceof AggregateError
          ? error.message
          : error instanceof FirebaseError &&
              ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(error.code)
            ? 'The password is incorrect. Your account was not deleted.'
            : 'Account deletion could not be completed. Please retry or contact support.',
      );
    } finally {
      this.pending.set(false);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof AggregateError) {
      return error.message;
    }
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          return 'The email or password is incorrect.';
        case 'auth/email-already-in-use':
          return 'An account with this email already exists.';
        case 'auth/weak-password':
          return 'Please choose a stronger password with at least 6 characters.';
        case 'auth/invalid-email':
          return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
          return 'Too many attempts. Please try again later.';
        case 'auth/network-request-failed':
          return 'Connection failed. Please check your internet connection.';
        case 'auth/operation-not-allowed':
          return 'Email/password sign-in is not enabled in Firebase.';
        case 'PERMISSION_DENIED':
        case 'permission-denied':
          return 'The profile could not be saved. Check the Firebase database rules and try registering again.';
      }
    }
    console.error('Firebase authentication failed', error);
    return 'Authentication failed. Please try again.';
  }
}
