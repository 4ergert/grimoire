import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Auth } from './auth';

const firebase = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  getDatabase: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((_auth: unknown, _listener: (user: unknown) => void) => vi.fn()),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  deleteUser: vi.fn(),
  ref: vi.fn((_database: unknown, path: string) => path),
  set: vi.fn(),
}));

vi.mock('firebase/app', () => ({ initializeApp: firebase.initializeApp }));
vi.mock('firebase/auth', () => ({
  getAuth: firebase.getAuth,
  onAuthStateChanged: firebase.onAuthStateChanged,
  createUserWithEmailAndPassword: firebase.createUserWithEmailAndPassword,
  signInWithEmailAndPassword: firebase.signInWithEmailAndPassword,
  signOut: firebase.signOut,
  updateProfile: firebase.updateProfile,
  deleteUser: firebase.deleteUser,
}));
vi.mock('firebase/database', () => ({
  getDatabase: firebase.getDatabase,
  ref: firebase.ref,
  set: firebase.set,
}));

describe('Auth', () => {
  let auth: Auth;
  const user = { uid: 'user-123', displayName: 'Test User' };

  beforeEach(() => {
    vi.clearAllMocks();
    firebase.createUserWithEmailAndPassword.mockResolvedValue({ user });
    firebase.updateProfile.mockResolvedValue(undefined);
    firebase.set.mockResolvedValue(undefined);
    firebase.deleteUser.mockResolvedValue(undefined);
    TestBed.configureTestingModule({});
    auth = TestBed.inject(Auth);
  });

  it('should register credentials only in Auth and save only the username in the database', async () => {
    await auth.register('Test User', 'test@example.com', 'test-password');

    expect(firebase.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'test-password',
    );
    expect(firebase.updateProfile).toHaveBeenCalledWith(user, { displayName: 'Test User' });
    expect(firebase.ref).toHaveBeenCalledWith(expect.anything(), 'users/user-123');
    expect(firebase.set).toHaveBeenCalledWith('users/user-123', { username: 'Test User' });
    expect(auth.user()).toBe(user);
  });

  it('should remove a new account if saving its profile fails', async () => {
    const error = new Error('Permission denied');
    firebase.set.mockRejectedValue(error);

    await expect(auth.register('Test User', 'test@example.com', 'test-password')).rejects.toBe(
      error,
    );
    expect(firebase.deleteUser).toHaveBeenCalledWith(user);
  });

  it('should explicitly report rollback failures', async () => {
    firebase.set.mockRejectedValue(new Error('Permission denied'));
    firebase.deleteUser.mockRejectedValue(new Error('Offline'));

    await expect(auth.register('Test User', 'test@example.com', 'test-password')).rejects.toThrow(
      'The account was created, but the profile could not be saved',
    );
  });

  it('should not write a profile if account creation fails', async () => {
    firebase.createUserWithEmailAndPassword.mockRejectedValue(new Error('Already registered'));

    await expect(auth.register('Test User', 'test@example.com', 'test-password')).rejects.toThrow(
      'Already registered',
    );
    expect(firebase.set).not.toHaveBeenCalled();
  });

  it('should log in and out using Firebase Auth', async () => {
    await auth.login('test@example.com', 'test-password');
    await auth.logout();

    expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'test-password',
    );
    expect(firebase.signOut).toHaveBeenCalledWith(expect.anything());
  });

  it('should reflect session restoration and logout notifications', () => {
    const listener = firebase.onAuthStateChanged.mock.calls[0][1];
    listener(user);
    expect(auth.user()).toBe(user);
    listener(null);
    expect(auth.user()).toBeNull();
  });
});
