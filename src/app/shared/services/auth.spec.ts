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
  credential: vi.fn((email: string, password: string) => ({ email, password })),
  reauthenticateWithCredential: vi.fn(),
  update: vi.fn(),
  ref: vi.fn((_database: unknown, path = '') => path),
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
  EmailAuthProvider: { credential: firebase.credential },
  reauthenticateWithCredential: firebase.reauthenticateWithCredential,
}));
vi.mock('firebase/database', () => ({
  getDatabase: firebase.getDatabase,
  ref: firebase.ref,
  set: firebase.set,
  update: firebase.update,
}));

describe('Auth', () => {
  let auth: Auth;
  const user = { uid: 'user-123', displayName: 'Test User', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    firebase.createUserWithEmailAndPassword.mockResolvedValue({ user });
    firebase.updateProfile.mockResolvedValue(undefined);
    firebase.set.mockResolvedValue(undefined);
    firebase.deleteUser.mockResolvedValue(undefined);
    firebase.reauthenticateWithCredential.mockResolvedValue(undefined);
    firebase.update.mockResolvedValue(undefined);
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

  it('reauthenticates before deleting both database paths and then the account', async () => {
    firebase.onAuthStateChanged.mock.calls[0][1](user);
    await auth.deleteAccount('current-password');
    expect(firebase.credential).toHaveBeenCalledWith(user.email, 'current-password');
    expect(firebase.reauthenticateWithCredential).toHaveBeenCalledWith(
      user, { email: user.email, password: 'current-password' },
    );
    expect(firebase.update).toHaveBeenCalledWith('', {
      'users/user-123': null,
      'gameLibrary/user-123': null,
    });
    expect(firebase.deleteUser).toHaveBeenCalledWith(user);
    expect(firebase.reauthenticateWithCredential.mock.invocationCallOrder[0])
      .toBeLessThan(firebase.update.mock.invocationCallOrder[0]);
    expect(firebase.update.mock.invocationCallOrder[0])
      .toBeLessThan(firebase.deleteUser.mock.invocationCallOrder[0]);
    expect(auth.user()).toBeNull();
  });

  it('does not delete any data if password verification fails', async () => {
    firebase.onAuthStateChanged.mock.calls[0][1](user);
    firebase.reauthenticateWithCredential.mockRejectedValueOnce(new Error('Wrong password'));
    await expect(auth.deleteAccount('wrong')).rejects.toThrow('Wrong password');
    expect(firebase.update).not.toHaveBeenCalled();
    expect(firebase.deleteUser).not.toHaveBeenCalled();
    expect(auth.user()).toBe(user);
  });

  it('does not delete the Auth account when database deletion fails', async () => {
    firebase.onAuthStateChanged.mock.calls[0][1](user);
    firebase.update.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(auth.deleteAccount('current-password')).rejects.toThrow('Permission denied');
    expect(firebase.deleteUser).not.toHaveBeenCalled();
    expect(auth.user()).toBe(user);
  });

  it('reports partial deletion and permits retrying', async () => {
    firebase.onAuthStateChanged.mock.calls[0][1](user);
    firebase.deleteUser.mockRejectedValueOnce(new Error('Offline'));
    await expect(auth.deleteAccount('current-password')).rejects.toThrow(
      'Your profile and saved games were deleted, but your sign-in account could not be deleted.',
    );
    expect(auth.user()).toBe(user);
    await auth.deleteAccount('current-password');
    expect(auth.user()).toBeNull();
  });

  it('rejects deletion without an authenticated user or password', async () => {
    await expect(auth.deleteAccount('password')).rejects.toThrow('Please sign in');
    firebase.onAuthStateChanged.mock.calls[0][1](user);
    await expect(auth.deleteAccount('')).rejects.toThrow('Please sign in');
    expect(firebase.reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(firebase.update).not.toHaveBeenCalled();
  });
});
