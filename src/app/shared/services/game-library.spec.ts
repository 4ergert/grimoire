import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { signal } from '@angular/core';
import { Chess } from 'chess.js';
import { Auth } from './auth';
import { DATABASE_API, GameLibrary } from './game-library';

const database = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  ref: vi.fn((_db: unknown, path: string) => path),
  push: vi.fn((path: string) => `${path}/new-id`),
};

describe('GameLibrary', () => {
  const user = signal<{ uid: string } | null>({ uid: 'user-a' });
  let library: GameLibrary;

  beforeEach(() => {
    vi.clearAllMocks();
    user.set({ uid: 'user-a' });
    database.set.mockResolvedValue(undefined);
    database.remove.mockResolvedValue(undefined);
    database.get.mockResolvedValue({ exists: () => true });
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { user, database: {} } },
        { provide: DATABASE_API, useValue: database },
      ],
    });
    library = TestBed.inject(GameLibrary);
  });

  it('should create folders under the signed-in user and reject empty names', async () => {
    await library.createFolder(' Training ');
    expect(database.set).toHaveBeenCalledWith('gameLibrary/user-a/folders/new-id', {
      name: 'Training',
      color: 'w',
    });
    await library.createFolder('Defence', 'b');
    expect(database.set).toHaveBeenLastCalledWith('gameLibrary/user-a/folders/new-id', {
      name: 'Defence',
      color: 'b',
    });
    await expect(library.createFolder(' ')).rejects.toThrow('name');
    user.set(null);
    await expect(library.list()).rejects.toThrow('sign in');
  });

  it('should change the practise color of a folder and reject invalid input', async () => {
    await library.setFolderColor('folder-1', 'b');
    expect(database.set).toHaveBeenCalledWith('gameLibrary/user-a/folders/folder-1/color', 'b');
    database.set.mockClear();
    await expect(library.setFolderColor('../other', 'b')).rejects.toThrow('valid folder');
    await expect(library.setFolderColor('folder-1', 'x' as 'w')).rejects.toThrow('White or Black');
    expect(database.set).not.toHaveBeenCalled();
  });

  it('should save valid PGN to the selected folder and isolate users', async () => {
    const game = new Chess();
    game.move('e4');
    user.set({ uid: 'user-b' });
    await library.save('folder-1', 'Opening', game.pgn());
    expect(database.set).toHaveBeenCalledWith('gameLibrary/user-b/folders/folder-1/games/new-id', {
      name: 'Opening',
      pgn: game.pgn(),
    });
    await expect(library.save('../other', 'Opening', game.pgn())).rejects.toThrow('valid folder');
    await expect(library.save('folder-1', 'Empty', new Chess().pgn())).rejects.toThrow('one move');
    database.get.mockResolvedValue({ exists: () => false });
    await expect(library.save('missing', 'Opening', game.pgn())).rejects.toThrow(
      'no longer exists',
    );
  });

  it('should propagate denied writes rather than reporting success', async () => {
    database.set.mockRejectedValue(new Error('Permission denied'));
    await expect(library.createFolder('Training')).rejects.toThrow('Permission denied');
  });

  it('should delete only the selected game belonging to the signed-in user', async () => {
    await library.deleteGame('folder-1', 'game-1');
    expect(database.remove).toHaveBeenCalledWith(
      'gameLibrary/user-a/folders/folder-1/games/game-1',
    );
    database.remove.mockClear();
    await expect(library.deleteGame('../other', 'game-1')).rejects.toThrow('valid');
    await expect(library.deleteGame('folder-1', '')).rejects.toThrow('valid');
    user.set(null);
    await expect(library.deleteGame('folder-1', 'game-1')).rejects.toThrow('sign in');
    expect(database.remove).not.toHaveBeenCalled();
  });

  it('should delete only the selected folder belonging to the signed-in user', async () => {
    await library.deleteFolder('folder-1');
    expect(database.remove).toHaveBeenCalledWith('gameLibrary/user-a/folders/folder-1');
    database.remove.mockClear();
    await expect(library.deleteFolder('../other')).rejects.toThrow('valid');
    await expect(library.deleteFolder('')).rejects.toThrow('valid');
    user.set(null);
    await expect(library.deleteFolder('folder-1')).rejects.toThrow('sign in');
    expect(database.remove).not.toHaveBeenCalled();
    user.set({ uid: 'user-a' });
    database.remove.mockRejectedValue(new Error('Permission denied'));
    await expect(library.deleteFolder('folder-1')).rejects.toThrow('Permission denied');
  });

  it('should propagate rejected deletions', async () => {
    database.remove.mockRejectedValue(new Error('Permission denied'));
    await expect(library.deleteGame('folder-1', 'game-1')).rejects.toThrow('Permission denied');
  });

  it('should list folder names and their saved PGNs', async () => {
    const game = {
      key: 'game-1',
      child: (field: string) => ({ val: () => (field === 'name' ? 'Opening' : '1. e4 *') }),
    };
    const folder = {
      key: 'folder-1',
      child: (field: string) =>
        field === 'name'
          ? { val: () => 'Training' }
          : field === 'color'
            ? { val: () => 'b' }
            : { forEach: (visit: (value: typeof game) => void) => visit(game) },
    };
    const legacy = {
      key: 'folder-2',
      child: (field: string): { val?: () => unknown; forEach?: () => void } =>
        field === 'name'
          ? { val: () => 'Old' }
          : field === 'color'
            ? { val: () => null }
            : { forEach: () => undefined },
    };
    database.get.mockResolvedValue({
      forEach: (visit: (value: typeof folder | typeof legacy) => void) => {
        visit(folder);
        visit(legacy);
      },
    });
    await expect(library.list()).resolves.toEqual([
      {
        id: 'folder-1',
        name: 'Training',
        color: 'b',
        games: [{ id: 'game-1', name: 'Opening', pgn: '1. e4 *' }],
      },
      { id: 'folder-2', name: 'Old', color: 'w', games: [] },
    ]);
  });
});
