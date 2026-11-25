import { computed, signal } from '@angular/core';
import { Chess, Color, Move, Square } from 'chess.js';
import { SavedGame } from '../../../services/game-library';
import { tr } from '../../../i18n/i18n';

/** A saved game prepared for practice: its starting FEN and its full move list. */
interface TrainingLine {
  initial: string;
  moves: Move[];
}

/**
 * Practice mode in which the user replays the moves of one color from saved games.
 *
 * The opponent's moves are played automatically; the user must find the saved move for their own
 * color. The games of a round are shuffled and played one after another.
 */
export class TrainingSession {
  private readonly game = new Chess();
  private lines: TrainingLine[] = [];
  /** FEN of the current position. */
  readonly position = signal(this.game.fen());
  /** FEN of every position played so far in the current game, starting with the initial one. */
  readonly positions = computed(() => {
    this.position();
    this.ply();
    this.gameIndex();
    const moves = this.game.history({ verbose: true });
    return [moves[0]?.before ?? this.game.fen(), ...moves.map((move) => move.after)];
  });
  /** The color the user practises. */
  readonly color = signal<Color>('w');
  /** Zero-based index of the current game within the shuffled round. */
  readonly gameIndex = signal(0);
  /** Number of games in the round. */
  readonly gameCount = signal(0);
  /** Number of moves of the current game already played, including the opponent's. */
  readonly ply = signal(0);
  /** Total number of moves in the current game. */
  readonly moveCount = signal(0);
  /** Wrong move attempts in the round. */
  readonly mistakes = signal(0);
  /** Number of moves for which a hint was used (each move counts once). */
  readonly hints = signal(0);
  /** Number of moves that were revealed (each move counts once). */
  readonly shownMoves = signal(0);
  /** Translated feedback about the last attempt, or an empty string. */
  readonly feedback = signal('');
  /** Origin square of the expected move while a hint is active, otherwise `null`. */
  readonly hintSquare = signal<Square | null>(null);
  /** SAN of the expected move once revealed, otherwise an empty string. */
  readonly revealedMove = signal('');
  /** Whether all moves of the current game have been played. */
  readonly complete = computed(() => this.ply() === this.moveCount());
  /** Whether the current game is complete and is the last one of the round. */
  readonly roundComplete = computed(
    () => this.complete() && this.gameIndex() === this.gameCount() - 1,
  );
  private line(): TrainingLine {
    return this.lines[this.gameIndex()];
  }

  /**
   * Starts a new round with the games in random order and resets the statistics.
   *
   * @param color - The color the user plays.
   * @throws If there are no games or a game has no move for the chosen color. Invalid PGNs also throw (from chess.js).
   */
  start(games: readonly SavedGame[], color: Color): void {
    if (!games.length) throw new Error(tr('This folder has no games to practise.'));
    const lines = games.map((saved) => {
      const game = new Chess();
      game.loadPgn(saved.pgn);
      const moves = game.history({ verbose: true });
      if (!moves.some((move) => move.color === color)) {
        throw new Error(tr('Each game must contain at least one move for your chosen color.'));
      }
      return { initial: moves[0].before, moves };
    });
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    this.lines = lines;
    this.color.set(color);
    this.gameCount.set(lines.length);
    this.gameIndex.set(0);
    this.mistakes.set(0);
    this.hints.set(0);
    this.shownMoves.set(0);
    this.loadLine();
  }

  private loadLine(): void {
    this.game.load(this.line().initial);
    this.ply.set(0);
    this.moveCount.set(this.line().moves.length);
    this.clearHelp();
    this.feedback.set('');
    this.playOpponent();
  }

  private clearHelp(): void {
    this.hintSquare.set(null);
    this.revealedMove.set('');
  }

  /** Plays the opponent's moves until it is the user's turn or the game ends. */
  private playOpponent(): void {
    while (!this.complete() && this.game.turn() !== this.color()) {
      this.game.move(this.line().moves[this.ply()].san);
      this.ply.update((value) => value + 1);
    }
    this.position.set(this.game.fen());
  }

  /**
   * Checks the user's move against the saved one. A correct move is played, followed by the opponent's replies;
   * a wrong one counts as a mistake and leaves the position unchanged.
   *
   * @returns Whether the move matched the saved move.
   */
  tryMove(from: Square, to: Square, promotion?: string): boolean {
    if (this.complete()) return false;
    const expected = this.line().moves[this.ply()];
    if (expected.from !== from || expected.to !== to || expected.promotion !== promotion) {
      this.mistakes.update((value) => value + 1);
      this.feedback.set(tr('Not the saved move. Try again; your position has not changed.'));
      return false;
    }
    this.game.move(expected.san);
    this.ply.update((value) => value + 1);
    this.clearHelp();
    this.feedback.set(tr('Correct!'));
    this.playOpponent();
    return true;
  }

  /** Highlights the origin square of the expected move; counted once per move. */
  hint(): void {
    if (this.complete()) return;
    if (!this.hintSquare()) this.hints.update((value) => value + 1);
    this.hintSquare.set(this.line().moves[this.ply()].from);
  }

  /** Shows the SAN of the expected move without playing it; counted once per move. */
  reveal(): void {
    if (this.complete()) return;
    if (!this.revealedMove()) this.shownMoves.update((value) => value + 1);
    this.revealedMove.set(this.line().moves[this.ply()].san);
  }

  /** Plays the expected move after it has been revealed; does nothing otherwise. */
  playRevealed(): void {
    if (this.complete() || !this.revealedMove()) return;
    const expected = this.line().moves[this.ply()];
    this.tryMove(expected.from, expected.to, expected.promotion);
  }

  /** Advances to the next game of the round once the current one is complete; does nothing on the last game. */
  next(): void {
    if (!this.complete() || this.roundComplete()) return;
    this.gameIndex.update((value) => value + 1);
    this.loadLine();
  }
}
