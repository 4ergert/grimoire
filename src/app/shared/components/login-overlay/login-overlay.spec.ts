import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import { vi } from 'vitest';

import { LoginOverlay } from './login-overlay';
import { Auth } from '../../services/auth';

describe('LoginOverlay', () => {
  let component: LoginOverlay;
  let fixture: ComponentFixture<LoginOverlay>;
  const auth = {
    user: signal<{ displayName: string | null; email: string | null } | null>(null),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.user.set(null);
    await TestBed.configureTestingModule({
      imports: [LoginOverlay],
      providers: [{ provide: Auth, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
    expect(element.querySelector('form')).toBeNull();
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
    expect(element.querySelector('form')).toBeNull();

    auth.logout.mockRejectedValue(new FirebaseError('auth/network-request-failed', 'Offline'));
    element.querySelector<HTMLButtonElement>('.logout_button')!.click();
    await fixture.whenStable();

    expect(element.querySelector('app-menu-overlay')).not.toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Connection failed');
  });
});
