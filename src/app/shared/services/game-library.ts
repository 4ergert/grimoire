import { Injectable, inject } from '@angular/core';
import { get, push, ref, set } from 'firebase/database';
import { Chess } from 'chess.js';
import { Auth } from './auth';

export interface SavedGame {
  id: string;
  name: string;
  pgn: string;
}

export interface GameFolder {
  id: string;
  name: string;
  games: SavedGame[];
}

@Injectable({ providedIn: 'root' })
export class GameLibrary {
  private readonly auth = inject(Auth);

  private path(): string {
    const user = this.auth.user();
    if (!user) throw new Error('Please sign in to access your saved games.');
    return `gameLibrary/${user.uid}/folders`;
  }

  private name(value: string): string {
    const name = value.trim();
    if (!name || name.length > 100) throw new Error('Please enter a name of 1 to 100 characters.');
    return name;
  }

  async list(): Promise<GameFolder[]> {
    const snapshot = await get(ref(this.auth.database, this.path()));
    const folders: GameFolder[] = [];
    snapshot.forEach((folder) => {
      const name: unknown = folder.child('name').val();
      if (typeof name !== 'string') throw new Error('A saved folder has invalid data.');
      const games: SavedGame[] = [];
      folder.child('games').forEach((game) => {
        const name: unknown = game.child('name').val();
        const pgn: unknown = game.child('pgn').val();
        if (typeof name !== 'string' || typeof pgn !== 'string') {
          throw new Error('A saved game has invalid data.');
        }
        games.push({ id: game.key!, name, pgn });
      });
      folders.push({ id: folder.key!, name, games });
    });
    return folders;
  }

  async createFolder(name: string): Promise<void> {
    const value = this.name(name);
    await set(push(ref(this.auth.database, this.path())), { name: value });
  }

  async save(folderId: string, name: string, pgn: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]+$/.test(folderId)) throw new Error('Please select a valid folder.');
    const value = this.name(name);
    if (pgn.length > 100000) throw new Error('The PGN is too large.');
    const game = new Chess();
    game.loadPgn(pgn);
    if (!game.history().length) throw new Error('Make at least one move before saving.');
    const path = `${this.path()}/${folderId}`;
    if (!(await get(ref(this.auth.database, `${path}/name`))).exists()) {
      throw new Error('This folder no longer exists. Please reload your folders.');
    }
    await set(push(ref(this.auth.database, `${path}/games`)), { name: value, pgn });
  }
}
