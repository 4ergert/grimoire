import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Auth, UsernameTakenError } from './auth';

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
  sendEmailVerification: vi.fn(),
  reload: vi.fn(),
  credential: vi.fn((email: string, password: string) => ({ email, password })),
  reauthenticateWithCredential: vi.fn(),
  update: vi.fn(),
  ref: vi.fn((_database: unknown, path = '') => path),
  get: vi.fn(),
  onValue: vi.fn((_ref: unknown, _next: (snapshot: { val: () => unknown }) => void, _error: (error: Error) => void) => vi.fn()),
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
  sendEmailVerification: firebase.sendEmailVerification,
  reload: firebase.reload,
  EmailAuthProvider: { credential: firebase.credential },
  reauthenticateWithCredential: firebase.reauthenticateWithCredential,
}));
vi.mock('firebase/database', () => ({
  getDatabase: firebase.getDatabase,
  ref: firebase.ref,
  get: firebase.get,
  onValue: firebase.onValue,
  update: firebase.update,
}));

describe('Auth', () => {
  let auth: Auth;
  const user = { uid: 'user-123', displayName: 'TestUser', email: 'test@example.com' };
  const snapshot = (value: unknown) => ({
    exists: () => value != null,
    val: () => value,
    child: () => ({ val: () => (value as { username?: string } | null)?.username }),
  });

  beforeEach(() => {
    vi.resetAllMocks();
    firebase.initializeApp.mockReturnValue({});
    firebase.getAuth.mockReturnValue({});
    firebase.getDatabase.mockReturnValue({});
    firebase.onAuthStateChanged.mockImplementation(() => vi.fn());
    firebase.onValue.mockImplementation(() => vi.fn());
    firebase.ref.mockImplementation((_database: unknown, path = '') => path);
    firebase.credential.mockImplementation((email: string, password: string) => ({ email, password }));
    firebase.createUserWithEmailAndPassword.mockResolvedValue({ user });
    firebase.updateProfile.mockResolvedValue(undefined);
    firebase.get.mockImplementation(async (path: string) =>
      snapshot(path === 'users/user-123' ? { username: 'TestUser' } : null));
    firebase.deleteUser.mockResolvedValue(undefined);
    firebase.reauthenticateWithCredential.mockResolvedValue(undefined);
    firebase.update.mockResolvedValue(undefined);
    firebase.sendEmailVerification.mockResolvedValue(undefined);
    firebase.reload.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({});
    auth = TestBed.inject(Auth);
  });

  it('should register credentials only in Auth and save only the username in the database', async () => {
    await auth.register('TestUser', 'test@example.com', 'test-password');

    expect(firebase.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'test-password',
    );
    expect(firebase.updateProfile).toHaveBeenCalledWith(user, { displayName: 'TestUser' });
    expect(firebase.update).toHaveBeenCalledWith('', {
      'users/user-123': { username: 'TestUser' },
      'usernames/testuser': 'user-123',
    });
    expect(auth.user()).toBe(user);
    expect(firebase.sendEmailVerification).toHaveBeenCalledWith(user, {
      url: 'https://grimoire.julian-hergert.de/',
    });
    expect(firebase.getAuth.mock.results[0].value).toEqual(expect.objectContaining({ languageCode: 'en' }));
    expect(firebase.update.mock.invocationCallOrder[0])
      .toBeLessThan(firebase.sendEmailVerification.mock.invocationCallOrder[0]);
  });

  it('keeps the account and permits resending if verification email delivery fails', async () => {
    firebase.sendEmailVerification.mockRejectedValueOnce(new Error('Mail service unavailable'));
    await expect(auth.register('TestUser', 'test@example.com', 'test-password'))
      .rejects.toThrow('Your account was created, but the verification email could not be sent');
    expect(auth.user()).toBe(user);
    expect(firebase.deleteUser).not.toHaveBeenCalled();
    await auth.sendVerificationEmail();
    expect(firebase.sendEmailVerification).toHaveBeenCalledTimes(2);
  });

  it('does not send verification mail without a session or for a verified user', async () => {
    await expect(auth.sendVerificationEmail()).rejects.toThrow('Please sign in');
    firebase.onAuthStateChanged.mock.calls[0][1]({ ...user, emailVerified: true });
    await expect(auth.sendVerificationEmail()).rejects.toThrow('already verified');
    expect(firebase.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('reloads verification and refreshes the token before publishing the updated user', async () => {
    const current = { ...user, emailVerified: false, getIdToken: vi.fn().mockResolvedValue('token') };
    firebase.onAuthStateChanged.mock.calls[0][1](current);
    firebase.reload.mockImplementationOnce(async () => { current.emailVerified = true; });
    expect(await auth.refreshVerification()).toBe(true);
    expect(firebase.reload).toHaveBeenCalledWith(current);
    expect(current.getIdToken).toHaveBeenCalledWith(true);
    expect(firebase.reload.mock.invocationCallOrder[0])
      .toBeLessThan(current.getIdToken.mock.invocationCallOrder[0]);
    expect(auth.user()?.emailVerified).toBe(true);
  });

  it('returns an unverified status and reports refresh failures', async () => {
    const current = { ...user, emailVerified: false, getIdToken: vi.fn().mockResolvedValue('token') };
    firebase.onAuthStateChanged.mock.calls[0][1](current);
    expect(await auth.refreshVerification()).toBe(false);
    firebase.reload.mockRejectedValueOnce(new Error('Offline'));
    await expect(auth.refreshVerification()).rejects.toThrow('Offline');
    current.getIdToken.mockRejectedValueOnce(new Error('Token refresh failed'));
    await expect(auth.refreshVerification()).rejects.toThrow('Token refresh failed');
  });

  it('does not restore a user when the session changes during verification', async () => {
    const current = { ...user, emailVerified: true, getIdToken: vi.fn().mockResolvedValue('token') };
    firebase.onAuthStateChanged.mock.calls[0][1](current);
    firebase.reload.mockImplementationOnce(async () => {
      firebase.onAuthStateChanged.mock.calls[0][1](null);
    });
    await expect(auth.refreshVerification()).rejects.toThrow('Your session changed');
    expect(auth.user()).toBeNull();
  });

  it('does not unlock access when verification reloads but token refresh fails', async () => {
    const current = {
      ...user,
      emailVerified: false,
      getIdToken: vi.fn().mockRejectedValue(new Error('Offline')),
    };
    firebase.onAuthStateChanged.mock.calls[0][1](current);
    firebase.reload.mockImplementationOnce(async () => { current.emailVerified = true; });
    await expect(auth.refreshVerification()).rejects.toThrow('Offline');
    expect(auth.emailVerified()).toBe(false);
  });
  it('should remove a new account if saving its profile fails', async () => {
    const error = new Error('Permission denied');
    firebase.update.mockRejectedValueOnce(error);
    firebase.get.mockResolvedValue(snapshot(null));

    await expect(auth.register('TestUser', 'test@example.com', 'test-password')).rejects.toBe(
      error,
    );
    expect(firebase.deleteUser).toHaveBeenCalledWith(user);
    expect(firebase.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('should explicitly report rollback failures', async () => {
    firebase.update.mockRejectedValueOnce(new Error('Permission denied'));
    firebase.get.mockResolvedValue(snapshot(null));
    firebase.deleteUser.mockRejectedValue(new Error('Offline'));

    await expect(auth.register('TestUser', 'test@example.com', 'test-password')).rejects.toThrow(
      'Registration failed and the new account could not be fully removed',
    );
  });

  it('reports an occupied case-insensitive name and removes the newly created Auth account', async () => {
    firebase.update.mockRejectedValueOnce(new Error('Permission denied'));
    firebase.get.mockImplementation(async (path: string) =>
      snapshot(path === 'usernames/testuser' ? 'another-user' : null));

    await expect(auth.register('TestUser', 'test@example.com', 'test-password'))
      .rejects.toBeInstanceOf(UsernameTakenError);
    expect(firebase.deleteUser).toHaveBeenCalledWith(user);
  });

  it('cleans up a committed profile and reservation before rolling back an uncertain write', async () => {
    firebase.update.mockRejectedValueOnce(new Error('Connection interrupted'));
    firebase.get.mockImplementation(async (path: string) =>
      snapshot(path === 'users/user-123' ? { username: 'TestUser' } : 'user-123'));

    await expect(auth.register('TestUser', 'test@example.com', 'test-password'))
      .rejects.toThrow('Connection interrupted');
    expect(firebase.update).toHaveBeenLastCalledWith('', {
      'users/user-123': null,
      'usernames/testuser': null,
    });
    expect(firebase.deleteUser).toHaveBeenCalledWith(user);
  });

  it('retains the Auth account if the saved state cannot be checked during rollback', async () => {
    firebase.update.mockRejectedValueOnce(new Error('Connection interrupted'));
    firebase.get.mockRejectedValue(new Error('Offline'));
    await expect(auth.register('TestUser', 'test@example.com', 'test-password'))
      .rejects.toThrow('could not be fully removed');
    expect(firebase.deleteUser).not.toHaveBeenCalled();
  });

  it('rejects invalid usernames before creating an account', async () => {
    await expect(auth.register('Test User', 'test@example.com', 'test-password'))
      .rejects.toThrow('letters, numbers, or underscores');
    expect(firebase.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('uses the database profile name instead of the independently editable Auth display name', () => {
    firebase.onAuthStateChanged.mock.calls[0][1](user);
    const callback = firebase.onValue.mock.calls[0][1];
    callback(snapshot('ReservedName'));
    expect(auth.username()).toBe('ReservedName');
    firebase.onAuthStateChanged.mock.calls[0][1](null);
    expect(auth.username()).toBeNull();
  });

  it('should not write a profile if account creation fails', async () => {
    firebase.createUserWithEmailAndPassword.mockRejectedValue(new Error('Already registered'));

    await expect(auth.register('TestUser', 'test@example.com', 'test-password')).rejects.toThrow(
      'Already registered',
    );
    expect(firebase.update).not.toHaveBeenCalled();
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
      'usernames/testuser': null,
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
    firebase.get.mockResolvedValue(snapshot(null));
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
