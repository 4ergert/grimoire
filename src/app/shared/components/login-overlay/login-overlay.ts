import { Component, inject, signal } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import { RouterLink } from '@angular/router';
import { Auth, UsernameTakenError } from '../../services/auth';
import { MenuOverlay } from '../menu-overlay/menu-overlay';
import { PlayGround } from '../play-ground/play-ground';
import { GameLibrary } from '../game-library/game-library';
import { GameFolder } from '../../services/game-library';
import { CustomButton } from '../button/button';

type AuthField = 'name' | 'email' | 'password' | 'confirm-password';
type FieldErrors = Partial<Record<AuthField, string>>;
const MAX_AUTH_FIELD_LENGTH = 42;
const MIN_NAME_LENGTH = 4;

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
  readonly fieldErrors = signal<FieldErrors>({});
  private validationAttempted = false;
  readonly verificationNotice = signal('');
  readonly libraryOpen = signal(false);
  readonly savePgn = signal('');
  readonly replayPgn = signal('');
  readonly trainingFolder = signal<GameFolder | null>(null);

  startGuest(): void {
    this.error.set('');
    this.resetValidation();
    this.guest.set(true);
  }

  leaveGuest(): void {
    this.guest.set(false);
  }

  startTraining(folder: GameFolder): void {
    if (!this.requireVerifiedEmail()) return;
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
    if (!this.requireVerifiedEmail()) return;
    this.savePgn.set(pgn);
    this.libraryOpen.set(true);
  }

  openReplay(pgn: string): void {
    if (!this.requireVerifiedEmail()) return;
    this.computerGame.set(false);
    this.trainingFolder.set(null);
    this.replayPgn.set(pgn);
    this.isPlaying.set(true);
    this.libraryOpen.set(false);
  }

  startPlaying(computer = false): void {
    if (!this.requireVerifiedEmail()) return;
    this.computerGame.set(computer);
    this.trainingFolder.set(null);
    this.replayPgn.set('');
    this.isPlaying.set(true);
  }

  switchAuthMode(form: HTMLFormElement): void {
    form.reset();
    this.error.set('');
    this.resetValidation();
    this.isSignUp.update((value) => !value);
  }

  private resetValidation(): void {
    this.validationAttempted = false;
    this.fieldErrors.set({});
  }

  validateOnInput(form: HTMLFormElement): void {
    this.error.set('');
    if (this.validationAttempted) this.fieldErrors.set(this.validate(form));
  }

  private validate(form: HTMLFormElement): FieldErrors {
    const data = new FormData(form);
    const rawName = String(data.get('name') ?? '');
    const rawEmail = String(data.get('email') ?? '');
    const name = rawName.trim();
    const email = rawEmail.trim();
    const password = String(data.get('password') ?? '');
    const errors: FieldErrors = {};
    const emailInput = form.elements.namedItem('email');
    if (!(emailInput instanceof HTMLInputElement)) {
      throw new Error('Authentication form is missing its email field');
    }

    if (this.isSignUp()) {
      if (!name) errors.name = 'Please enter a name.';
      else if (rawName.length > MAX_AUTH_FIELD_LENGTH) errors.name = 'Please enter no more than 42 characters.';
      else if (name.length < MIN_NAME_LENGTH) errors.name = 'Please enter at least 4 characters.';
      else if (!/^[A-Za-z0-9_]+$/.test(name)) errors.name = 'Use only letters A-Z, numbers, and underscores.';
    }
    if (!email) errors.email = 'Please enter your email address.';
    else if (rawEmail.length > MAX_AUTH_FIELD_LENGTH) errors.email = 'Please enter no more than 42 characters.';
    else if (emailInput.validity.typeMismatch) errors.email = 'Please enter a valid email address.';
    if (!password) errors.password = 'Please enter your password.';
    else if (password.length > MAX_AUTH_FIELD_LENGTH) errors.password = 'Please enter no more than 42 characters.';
    else if (this.isSignUp() && password.length < 6) {
      errors.password = 'Please enter at least 6 characters.';
    }
    if (this.isSignUp()) {
      const confirmation = String(data.get('confirm-password') ?? '');
      if (!confirmation) errors['confirm-password'] = 'Please confirm your password.';
      else if (confirmation.length > MAX_AUTH_FIELD_LENGTH) errors['confirm-password'] = 'Please enter no more than 42 characters.';
      else if (password !== confirmation) errors['confirm-password'] = 'The passwords do not match.';
    }
    return errors;
  }

  async submit(event: Event, form: HTMLFormElement): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    this.error.set('');
    this.verificationNotice.set('');
    this.validationAttempted = true;
    const errors = this.validate(form);
    this.fieldErrors.set(errors);
    const firstInvalid = (['name', 'email', 'password', 'confirm-password'] as const)
      .find((field) => errors[field]);
    if (firstInvalid) {
      const input = form.elements.namedItem(firstInvalid);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }

    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const username = String(data.get('name') ?? '').trim();

    this.pending.set(true);
    try {
      if (this.isSignUp()) {
        await this.auth.register(username, email, password);
        this.verificationNotice.set('Verification email sent. Please check your inbox and spam folder.');
      } else {
        await this.auth.login(email, password);
      }
      form.reset();
      this.resetValidation();
    } catch (error) {
      if (this.isSignUp() && this.auth.user()) form.reset();
      if (error instanceof UsernameTakenError) {
        this.fieldErrors.set({ name: error.message });
        const name = form.elements.namedItem('name');
        if (name instanceof HTMLInputElement) name.focus();
      } else {
        this.error.set(this.errorMessage(error));
      }
    } finally {
      this.pending.set(false);
    }
  }

  async resendVerificationEmail(): Promise<void> {
    if (this.pending()) return;
    this.error.set('');
    this.verificationNotice.set('');
    this.pending.set(true);
    try {
      await this.auth.sendVerificationEmail();
      this.verificationNotice.set('Verification email sent. Please check your inbox and spam folder.');
    } catch (error) {
      console.error('Verification email could not be sent', error);
      this.error.set(
        error instanceof FirebaseError && error.code === 'auth/too-many-requests'
          ? 'Too many requests. Please wait before requesting another verification email.'
          : 'The verification email could not be sent. Please try again later.',
      );
    } finally {
      this.pending.set(false);
    }
  }

  async checkVerification(): Promise<void> {
    if (this.pending()) return;
    this.error.set('');
    this.verificationNotice.set('');
    this.pending.set(true);
    try {
      if (!(await this.auth.refreshVerification())) {
        this.verificationNotice.set(
          'Your email is not verified yet. Open the link in your email, then check again.',
        );
      }
    } catch (error) {
      console.error('Email verification check failed', error);
      this.error.set('Verification could not be checked. Please try again or sign in again.');
    } finally {
      this.pending.set(false);
    }
  }

  private requireVerifiedEmail(): boolean {
    if (this.auth.user() && this.auth.emailVerified()) return true;
    this.error.set('Please verify your email address before using this feature.');
    return false;
  }

  async logout(): Promise<void> {
    this.error.set('');
    this.verificationNotice.set('');
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
