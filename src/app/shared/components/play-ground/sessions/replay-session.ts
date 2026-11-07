import { signal } from '@angular/core';
import { Chess } from 'chess.js';

export class ReplaySession {
  readonly positions = signal<string[]>([]);
  readonly index = signal(0);
  readonly moves = signal<string[]>([]);
  readonly error = signal('');

  load(pgn: string): void {
    try {
      const replay = new Chess();
      replay.loadPgn(pgn);
      const moves = replay.history({ verbose: true });
      this.positions.set([moves[0]?.before ?? replay.fen(), ...moves.map((move) => move.after)]);
      this.moves.set(moves.map((move) => move.san));
      this.index.set(0);
      this.error.set('');
    } catch (error) {
      console.error('PGN replay could not be loaded', error);
      this.clear();
      this.error.set('This saved PGN could not be loaded.');
    }
  }

  clear(): void {
    this.positions.set([]);
    this.moves.set([]);
    this.index.set(0);
    this.error.set('');
  }
}
