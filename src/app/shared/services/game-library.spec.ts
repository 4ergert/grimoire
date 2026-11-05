import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { signal } from '@angular/core';
import { Chess } from 'chess.js';
import { Auth } from './auth';
import { GameLibrary } from './game-library';

const database = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  ref: vi.fn((_db: unknown, path: string) => path),
  push: vi.fn((path: string) => `${path}/new-id`),
}));
vi.mock('firebase/database', () => database);

describe('GameLibrary', () => {
  const user = signal<{ uid: string } | null>({ uid: 'user-a' });
  let library: GameLibrary;

  beforeEach(() => {
    vi.clearAllMocks();
    user.set({ uid: 'user-a' });
    database.set.mockResolvedValue(undefined);
    database.get.mockResolvedValue({ exists: () => true });
    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: { user, database: {} } }],
    });
    library = TestBed.inject(GameLibrary);
  });

  it('should create folders under the signed-in user and reject empty names', async () => {
    await library.createFolder(' Training ');
    expect(database.set).toHaveBeenCalledWith('gameLibrary/user-a/folders/new-id', {
      name: 'Training',
    });
    await expect(library.createFolder(' ')).rejects.toThrow('name');
    user.set(null);
    await expect(library.list()).rejects.toThrow('sign in');
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
          : { forEach: (visit: (value: typeof game) => void) => visit(game) },
    };
    database.get.mockResolvedValue({
      forEach: (visit: (value: typeof folder) => void) => visit(folder),
    });
    await expect(library.list()).resolves.toEqual([
      {
        id: 'folder-1',
        name: 'Training',
        games: [{ id: 'game-1', name: 'Opening', pgn: '1. e4 *' }],
      },
    ]);
  });
});
