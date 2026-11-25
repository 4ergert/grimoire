import { signal } from '@angular/core';
import { Chess } from 'chess.js';
import { tr } from '../../../i18n/i18n';

/** Read-only playback state of a saved PGN. */
export class ReplaySession {
  /** FEN of every position, starting with the initial one (one more entry than {@link ReplaySession.moves}). */
  readonly positions = signal<string[]>([]);
  /** Index into {@link ReplaySession.positions} of the position currently shown. */
  readonly index = signal(0);
  /** SAN of each move of the loaded game. */
  readonly moves = signal<string[]>([]);
  /** Translated load error, or an empty string when there is none. */
  readonly error = signal('');

  /** Loads the PGN and rewinds to the start. On failure the session is cleared and {@link ReplaySession.error} is set instead of throwing. */
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
      this.error.set(tr('This saved PGN could not be loaded.'));
    }
  }

  /** Removes the loaded game and any error. */
  clear(): void {
    this.positions.set([]);
    this.moves.set([]);
    this.index.set(0);
    this.error.set('');
  }
}
