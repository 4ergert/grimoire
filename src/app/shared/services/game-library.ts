import { Injectable, InjectionToken, inject } from '@angular/core';
import { get, push, ref, remove, set } from 'firebase/database';
import { Chess, Color } from 'chess.js';
import { Auth } from './auth';
import { tr } from '../i18n/i18n';

// Injected so tests can replace the database without mocking the Firebase module itself.
export const DATABASE_API = new InjectionToken('Firebase Realtime Database API', {
  providedIn: 'root',
  factory: () => ({ get, push, ref, remove, set }),
});

export interface SavedGame {
  id: string;
  name: string;
  pgn: string;
}

export interface GameFolder {
  id: string;
  name: string;
  color: Color;
  games: SavedGame[];
}

@Injectable({ providedIn: 'root' })
export class GameLibrary {
  private readonly auth = inject(Auth);
  private readonly db = inject(DATABASE_API);

  private path(): string {
    const user = this.auth.user();
    if (!user) throw new Error(tr('Please sign in to access your saved games.'));
    return `gameLibrary/${user.uid}/folders`;
  }

  private name(value: string): string {
    const name = value.trim();
    if (!name || name.length > 100) throw new Error(tr('Please enter a name of 1 to 100 characters.'));
    return name;
  }

  async list(): Promise<GameFolder[]> {
    const snapshot = await this.db.get(this.db.ref(this.auth.database, this.path()));
    const folders: GameFolder[] = [];
    snapshot.forEach((folder) => {
      const name: unknown = folder.child('name').val();
      if (typeof name !== 'string') throw new Error(tr('A saved folder has invalid data.'));
      const games: SavedGame[] = [];
      folder.child('games').forEach((game) => {
        const name: unknown = game.child('name').val();
        const pgn: unknown = game.child('pgn').val();
        if (typeof name !== 'string' || typeof pgn !== 'string') {
          throw new Error(tr('A saved game has invalid data.'));
        }
        games.push({ id: game.key!, name, pgn });
      });
      // Folders created before the color setting existed are practised as White.
      const color: unknown = folder.child('color').val() ?? 'w';
      if (color !== 'w' && color !== 'b') throw new Error(tr('A saved folder has invalid data.'));
      folders.push({ id: folder.key!, name, color, games });
    });
    return folders;
  }

  async createFolder(name: string, color: Color = 'w'): Promise<void> {
    const value = this.name(name);
    this.validColor(color);
    await this.db.set(this.db.push(this.db.ref(this.auth.database, this.path())), {
      name: value,
      color,
    });
  }

  async setFolderColor(folderId: string, color: Color): Promise<void> {
    if (!/^[A-Za-z0-9_-]+$/.test(folderId)) throw new Error(tr('Please select a valid folder.'));
    this.validColor(color);
    await this.db.set(this.db.ref(this.auth.database, `${this.path()}/${folderId}/color`), color);
  }

  private validColor(color: string): void {
    if (color !== 'w' && color !== 'b') throw new Error(tr('Please choose White or Black.'));
  }

  async deleteFolder(folderId: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]+$/.test(folderId)) throw new Error(tr('Please select a valid folder.'));
    await this.db.remove(this.db.ref(this.auth.database, `${this.path()}/${folderId}`));
  }

  async deleteGame(folderId: string, gameId: string): Promise<void> {
    if (![folderId, gameId].every((id) => /^[A-Za-z0-9_-]+$/.test(id))) {
      throw new Error(tr('Please select a valid folder and game.'));
    }
    await this.db.remove(this.db.ref(this.auth.database, `${this.path()}/${folderId}/games/${gameId}`));
  }

  async save(folderId: string, name: string, pgn: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]+$/.test(folderId)) throw new Error(tr('Please select a valid folder.'));
    const value = this.name(name);
    if (pgn.length > 100000) throw new Error(tr('The PGN is too large.'));
    const game = new Chess();
    game.loadPgn(pgn);
    if (!game.history().length) throw new Error(tr('Make at least one move before saving.'));
    const path = `${this.path()}/${folderId}`;
    if (!(await this.db.get(this.db.ref(this.auth.database, `${path}/name`))).exists()) {
      throw new Error(tr('This folder no longer exists. Please reload your folders.'));
    }
    await this.db.set(this.db.push(this.db.ref(this.auth.database, `${path}/games`)), { name: value, pgn });
  }
}
