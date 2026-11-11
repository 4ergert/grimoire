import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import { afterEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';

import { LoginOverlay } from './login-overlay';
import { Auth } from '../../services/auth';
import { GameLibrary } from '../../services/game-library';

describe('LoginOverlay', () => {
  let component: LoginOverlay;
  let fixture: ComponentFixture<LoginOverlay>;
  const auth = {
    user: signal<{ displayName: string | null; email: string | null; emailVerified?: boolean } | null>(null),
    emailVerified: computed((): boolean => auth.user()?.emailVerified !== false),
    refreshVerification: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    sendVerificationEmail: vi.fn(),
  };

  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    vi.resetAllMocks();
    auth.user.set(null);
    await TestBed.configureTestingModule({
      imports: [LoginOverlay],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        {
          provide: GameLibrary,
          useValue: {
            list: async () => [
              {
                id: 'folder',
                name: 'Training',
                games: [{ id: 'game', name: 'Opening', pgn: '1. e4 e5 *' }],
              },
            ],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resends verification emails and displays delivery status', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com', emailVerified: false });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const resend = Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Resend verification email')!;
    resend.click();
    await fixture.whenStable();
    expect(auth.sendVerificationEmail).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('Verification email sent.');
    expect(component.pending()).toBe(false);
  });

  it('blocks unverified access until checking the confirmation succeeds', async () => {
    const user = { displayName: 'Test User', email: 'test@example.com', emailVerified: false };
    auth.user.set(user);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).not.toContain('Play against Stockfish');
    component.startPlaying(true);
    component.openLibrary();
    component.openReplay('1. e4 *');
    component.startTraining({ id: 'folder', name: 'Training', games: [] });
    expect(component.isPlaying()).toBe(false);
    expect(component.libraryOpen()).toBe(false);
    expect(component.error()).toContain('Please verify');
    auth.refreshVerification.mockResolvedValueOnce(false);
    await component.checkVerification();
    expect(component.verificationNotice()).toContain('not verified yet');
    auth.refreshVerification.mockImplementationOnce(async () => {
      auth.user.set({ ...user, emailVerified: true });
      return true;
    });
    const check = Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'I have verified')!;
    check.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Play against Stockfish');
    expect(element.textContent).not.toContain('I have verified');
    component.startPlaying(true);
    expect(component.isPlaying()).toBe(true);
  });

  it('reports verification check failures without unlocking the application', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.user.set({ displayName: 'Test User', email: 'test@example.com', emailVerified: false });
    auth.refreshVerification.mockRejectedValueOnce(new Error('Offline'));
    await component.checkVerification();
    expect(component.error()).toContain('Verification could not be checked');
    expect(component.pending()).toBe(false);
    expect(auth.emailVerified()).toBe(false);
  });

  it('reports verification delivery errors without discarding the account', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    auth.sendVerificationEmail.mockRejectedValue(new FirebaseError('auth/too-many-requests', 'Limit'));
    await component.resendVerificationEmail();
    expect(component.error()).toContain('Too many requests');
    expect(component.verificationNotice()).toBe('');
    expect(auth.user()).not.toBeNull();
    expect(component.pending()).toBe(false);
  });

  it('confirms account deletion with a password and returns to login', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    auth.deleteAccount.mockImplementation(async () => auth.user.set(null));
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const details = element.querySelector<HTMLDetailsElement>('.account-deletion')!;
    details.open = true;
    const form = details.querySelector<HTMLFormElement>('form')!;
    const password = form.querySelector<HTMLInputElement>('#delete-password')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    password.value = 'current-password';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(password.value).toBe('');
    await fixture.whenStable();
    expect(auth.deleteAccount).toHaveBeenCalledWith('current-password');
    expect(element.querySelector('app-menu-overlay')).toBeNull();
    expect(element.querySelector('#email')).not.toBeNull();
    expect(component.pending()).toBe(false);
  });

  it('allows cancelling account deletion without changing data', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    await fixture.whenStable();
    const details: HTMLDetailsElement = fixture.nativeElement.querySelector('.account-deletion');
    details.open = true;
    const password = details.querySelector<HTMLInputElement>('#delete-password')!;
    password.value = 'current-password';
    details.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    expect(password.value).toBe('');
    expect(details.open).toBe(false);
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('reports an incorrect deletion password and prevents duplicate submissions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    auth.deleteAccount.mockRejectedValue(new FirebaseError('auth/invalid-credential', 'Invalid'));
    component.pending.set(true);
    await component.deleteAccount('wrong');
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    component.pending.set(false);
    await component.deleteAccount('wrong');
    await fixture.whenStable();
    expect(component.error()).toContain('The password is incorrect');
    expect(component.pending()).toBe(false);
    expect(fixture.nativeElement.querySelector('.auth_error')?.textContent)
      .toContain('Your account was not deleted');
    expect(auth.user()).not.toBeNull();
  });

  it('lets guests play only against Stockfish and return to login', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const click = async (label: string) => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await fixture.whenStable();
    };
    await click('Play as guest');
    expect(auth.user()).toBeNull();
    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.register).not.toHaveBeenCalled();
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('app-menu-overlay')).toBeNull();
    expect(element.querySelector('app-game-library')).toBeNull();
    expect(element.textContent).toContain('Play as White');
    await click('Play as White');
    expect(element.querySelector('.save_button')).toBeNull();
    expect(element.textContent).not.toContain('Log Out');
    expect(element.textContent).toContain('New game');
    await click('New game');
    expect(element.querySelector('app-menu-overlay')).toBeNull();
    expect(element.querySelector('.save_button')).toBeNull();
    await click('Menu');
    expect(element.querySelector('app-play-ground')).toBeNull();
    expect(element.querySelector('form')).not.toBeNull();
    await click('Play as guest');
    expect(element.textContent).toContain('Play as Black');
    await click('Back');
    expect(element.querySelector('form')).not.toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('disables guest access while authentication is pending', async () => {
    component.pending.set(true);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const guest = Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Play as guest')!;
    expect(guest.disabled).toBe(true);
    guest.click();
    expect(component.guest()).toBe(false);
  });

  it('should expose computer play only through the dedicated main menu action', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const click = async (label: string) => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await fixture.whenStable();
    };
    await click('Create');
    expect(component.computerGame()).toBe(false);
    expect(element.textContent).not.toContain('Play as White');
    await click('Menu');
    await click('Play against Stockfish');
    expect(component.computerGame()).toBe(true);
    expect(element.textContent).toContain('Play as White');
    expect(element.textContent).toContain('Play as Black');
    await click('Play as White');
    expect(element.querySelector('dialog')).toBeNull();
    await click('New game');
    expect(component.computerGame()).toBe(true);
    await click('Menu');
    await click('Create');
    expect(component.computerGame()).toBe(false);
    expect(element.textContent).not.toContain('Play as Black');
  });
  it('should open a saved game from the menu and return from replay', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const libraryButton = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Saved games',
    )!;
    libraryButton.click();
    await fixture.whenStable();
    expect(element.querySelector('summary')?.textContent).toContain('Training');
    element.querySelector<HTMLButtonElement>('app-game-library li button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('app-game-library')).toBeNull();
    expect(element.querySelector('nav[aria-label="Replay controls"]')).not.toBeNull();
    const menuButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('app-play-ground button'),
    ).find((button) => button.textContent?.trim() === 'Menu')!;
    menuButton.click();
    await fixture.whenStable();
    expect(element.querySelector('app-menu-overlay')).not.toBeNull();
  });

  it('should preserve the game and selection when returning from the save library', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const click = async (label: string) => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await fixture.whenStable();
    };
    await click('Play');
    element.querySelector<HTMLButtonElement>('[data-square="e2"]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[data-square="e4"]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[data-square="e7"]')!.click();
    await fixture.whenStable();
    const playground = element.querySelector('app-play-ground');
    await click('Save game');
    expect(element.querySelector('app-game-library #game-name')).not.toBeNull();
    expect(component.savePgn()).toContain('1. e4');
    await click('Back');
    expect(element.querySelector('app-play-ground')).toBe(playground);
    expect(element.querySelector('[aria-label="e4 White Pawn"]')).not.toBeNull();
    expect(element.querySelector('[data-square="e7"]')?.classList.contains('selected')).toBe(true);
    expect(element.querySelector('.move-history')?.textContent).toContain('e4');
  });

  it('should launch folder training from the menu, play Black and return to normal play', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const click = async (label: string) => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await fixture.whenStable();
    };
    await click('Saved games');
    await click('Practise folder');
    expect(element.querySelector('app-game-library')).toBeNull();
    expect(element.querySelector('.move-history')).toBeNull();
    await click('Train Black');
    expect(element.querySelector('[aria-label="e4 White Pawn"]')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('[aria-label="e7 Black Pawn"]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[aria-label="e5"]')!.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Round complete!');
    await click('Menu');
    await click('Play');
    expect(element.querySelector('.training-panel')).toBeNull();
    expect(element.querySelector('.move-history')).not.toBeNull();
    expect(element.querySelector('[aria-label="e2 White Pawn"]')).not.toBeNull();
  });

  it('shows legal links only in the login and sign-up window', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const expectLinks = () => {
      expect(element.querySelector('footer a[href="/impressum"]')).not.toBeNull();
      expect(element.querySelector('footer a[href="/datenschutz"]')).not.toBeNull();
    };
    expectLinks();
    component.isSignUp.set(true);
    await fixture.whenStable();
    expectLinks();
    component.startGuest();
    await fixture.whenStable();
    expect(element.querySelector('.legal_links')).toBeNull();
    component.leaveGuest();
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    await fixture.whenStable();
    expect(element.querySelector('.legal_links')).toBeNull();
  });

  it('should show the login form initially', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('#name')).toBeNull();
    expect(element.querySelector('app-menu-overlay')).toBeNull();
    expect(element.querySelector('#confirm-password')).toBeNull();
    expect(element.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Log In');
    expect(element.querySelector('#password')?.getAttribute('autocomplete')).toBe(
      'current-password',
    );
  });

  it('should preserve the mounted board while the library hides it', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    component.startPlaying(true);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const playground = element.querySelector('app-play-ground');

    component.openLibrary('1. e4 *');
    await fixture.whenStable();
    expect(element.querySelector('.game-container')?.hasAttribute('hidden')).toBe(true);
    expect(element.querySelector('app-play-ground')).toBe(playground);
    expect(element.querySelector('#game-name')).not.toBeNull();

    component.libraryOpen.set(false);
    await fixture.whenStable();
    expect(element.querySelector('.game-container')?.hasAttribute('hidden')).toBe(false);
    expect(element.querySelector('app-play-ground')).toBe(playground);
    expect(element.querySelector('app-game-library')).toBeNull();
  });

  it('should switch to sign up and back without keeping entered credentials', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const email = element.querySelector<HTMLInputElement>('#email')!;
    const password = element.querySelector<HTMLInputElement>('#password')!;
    const toggle = element.querySelector<HTMLButtonElement>('.auth_switch')!;
    email.value = 'test@example.com';
    password.value = 'test-password';

    toggle.click();
    await fixture.whenStable();

    expect(element.querySelector('#name')).not.toBeNull();
    expect(element.querySelector('#confirm-password')).not.toBeNull();
    expect(element.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Sign Up');
    expect(password.autocomplete).toBe('new-password');
    expect(email.value).toBe('');
    expect(password.value).toBe('');

    toggle.click();
    await fixture.whenStable();

    expect(element.querySelector('#name')).toBeNull();
    expect(element.querySelector('#confirm-password')).toBeNull();
    expect(element.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Log In');
    expect(password.autocomplete).toBe('current-password');
  });

  function fillForm(signUp = false): HTMLFormElement {
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLInputElement>('#email')!.value = 'test@example.com';
    element.querySelector<HTMLInputElement>('#password')!.value = 'test-password';
    if (signUp) {
      element.querySelector<HTMLInputElement>('#name')!.value = ' Test User ';
      element.querySelector<HTMLInputElement>('#confirm-password')!.value = 'test-password';
    }
    return element.querySelector('form')!;
  }

  it('should submit credentials to Firebase Auth and clear the form', async () => {
    const form = fillForm();

    await component.submit(new Event('submit', { cancelable: true }), form);

    expect(auth.login).toHaveBeenCalledWith('test@example.com', 'test-password');
    expect(auth.register).not.toHaveBeenCalled();
    expect(form.querySelector<HTMLInputElement>('#password')!.value).toBe('');
    expect(component.pending()).toBe(false);
  });

  it('should register the username and reject mismatched passwords', async () => {
    component.isSignUp.set(true);
    await fixture.whenStable();
    const form = fillForm(true);
    form.querySelector<HTMLInputElement>('#confirm-password')!.value = 'different-password';

    await component.submit(new Event('submit'), form);

    expect(auth.register).not.toHaveBeenCalled();
    expect(component.error()).toBe('The passwords do not match.');

    form.querySelector<HTMLInputElement>('#confirm-password')!.value = 'test-password';
    await component.submit(new Event('submit'), form);

    expect(auth.register).toHaveBeenCalledWith('Test User', 'test@example.com', 'test-password');
    expect(component.error()).toBe('');
  });

  it('should report invalid credentials and allow another attempt', async () => {
    auth.login.mockRejectedValue(
      new FirebaseError('auth/invalid-credential', 'Invalid credentials'),
    );
    const form = fillForm();

    await component.submit(new Event('submit'), form);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'The email or password is incorrect.',
    );
    expect(component.pending()).toBe(false);
  });

  it('should prevent duplicate submissions while waiting', async () => {
    let finish!: () => void;
    auth.login.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const form = fillForm();
    const first = component.submit(new Event('submit'), form);

    await fixture.whenStable();
    expect(form.querySelector('fieldset')!.disabled).toBe(true);
    await component.submit(new Event('submit'), form);
    expect(auth.login).toHaveBeenCalledTimes(1);

    finish();
    await first;
    expect(component.pending()).toBe(false);
  });

  it('should report logout failures', async () => {
    auth.logout.mockRejectedValue(new FirebaseError('auth/network-request-failed', 'Offline'));

    await component.logout();

    expect(component.error()).toContain('Connection failed');
    expect(component.pending()).toBe(false);
  });

  it('should display the restored session and log out', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    auth.logout.mockImplementation(async () => auth.user.set(null));
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Test User');
    expect(element.querySelector('app-menu-overlay')).not.toBeNull();
    expect(element.querySelector('#email')).toBeNull();
    element.querySelector<HTMLButtonElement>('.logout_button')!.click();
    await fixture.whenStable();

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(element.querySelector('app-menu-overlay')).toBeNull();
    expect(element.querySelector('form')).not.toBeNull();
  });

  it('should show the menu after login and retain it if logout fails', async () => {
    const form = fillForm();
    auth.login.mockImplementation(async () => {
      auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    });
    await component.submit(new Event('submit'), form);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('app-menu-overlay')).not.toBeNull();
    expect(element.querySelector('#email')).toBeNull();

    auth.logout.mockRejectedValue(new FirebaseError('auth/network-request-failed', 'Offline'));
    element.querySelector<HTMLButtonElement>('.logout_button')!.click();
    await fixture.whenStable();

    expect(element.querySelector('app-menu-overlay')).not.toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Connection failed');
  });

  it('should replace the menu with a playground and log out through its burger menu', async () => {
    auth.user.set({ displayName: 'Test User', email: 'test@example.com' });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    element.querySelector<HTMLButtonElement>('.play_button')!.click();
    await fixture.whenStable();

    expect(element.querySelector('app-menu-overlay')).toBeNull();
    expect(element.querySelector('app-play-ground')).not.toBeNull();
    const menu = element.querySelector<HTMLDetailsElement>('app-game-controls details')!;
    expect(menu.open).toBe(false);
    menu.querySelector('summary')!.click();
    expect(menu.open).toBe(true);

    auth.logout.mockImplementation(async () => auth.user.set(null));
    const logout = Array.from(menu.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Log Out',
    )!;
    logout.click();
    await fixture.whenStable();

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(element.querySelector('app-play-ground')).toBeNull();
    expect(element.querySelector('form')).not.toBeNull();
  });
});
