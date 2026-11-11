import { computed, signal } from '@angular/core';
import { Chess, Color, Move, Square } from 'chess.js';
import { SavedGame } from '../../../services/game-library';

interface TrainingLine {
  initial: string;
  moves: Move[];
}

export class TrainingSession {
  private readonly game = new Chess();
  private lines: TrainingLine[] = [];
  readonly position = signal(this.game.fen());
  readonly positions = computed(() => {
    this.position();
    this.ply();
    this.gameIndex();
    const moves = this.game.history({ verbose: true });
    return [moves[0]?.before ?? this.game.fen(), ...moves.map((move) => move.after)];
  });
  readonly color = signal<Color>('w');
  readonly gameIndex = signal(0);
  readonly gameCount = signal(0);
  readonly ply = signal(0);
  readonly moveCount = signal(0);
  readonly mistakes = signal(0);
  readonly hints = signal(0);
  readonly shownMoves = signal(0);
  readonly feedback = signal('');
  readonly hintSquare = signal<Square | null>(null);
  readonly revealedMove = signal('');
  readonly complete = computed(() => this.ply() === this.moveCount());
  readonly roundComplete = computed(
    () => this.complete() && this.gameIndex() === this.gameCount() - 1,
  );
  private line(): TrainingLine {
    return this.lines[this.gameIndex()];
  }

  start(games: readonly SavedGame[], color: Color): void {
    if (!games.length) throw new Error('This folder has no games to practise.');
    const lines = games.map((saved) => {
      const game = new Chess();
      game.loadPgn(saved.pgn);
      const moves = game.history({ verbose: true });
      if (!moves.some((move) => move.color === color)) {
        throw new Error('Each game must contain at least one move for your chosen color.');
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

  private playOpponent(): void {
    while (!this.complete() && this.game.turn() !== this.color()) {
      this.game.move(this.line().moves[this.ply()].san);
      this.ply.update((value) => value + 1);
    }
    this.position.set(this.game.fen());
  }

  tryMove(from: Square, to: Square, promotion?: string): boolean {
    if (this.complete()) return false;
    const expected = this.line().moves[this.ply()];
    if (expected.from !== from || expected.to !== to || expected.promotion !== promotion) {
      this.mistakes.update((value) => value + 1);
      this.feedback.set('Not the saved move. Try again; your position has not changed.');
      return false;
    }
    this.game.move(expected.san);
    this.ply.update((value) => value + 1);
    this.clearHelp();
    this.feedback.set('Correct!');
    this.playOpponent();
    return true;
  }

  hint(): void {
    if (this.complete()) return;
    if (!this.hintSquare()) this.hints.update((value) => value + 1);
    this.hintSquare.set(this.line().moves[this.ply()].from);
  }

  reveal(): void {
    if (this.complete()) return;
    if (!this.revealedMove()) this.shownMoves.update((value) => value + 1);
    this.revealedMove.set(this.line().moves[this.ply()].san);
  }

  playRevealed(): void {
    if (this.complete() || !this.revealedMove()) return;
    const expected = this.line().moves[this.ply()];
    this.tryMove(expected.from, expected.to, expected.promotion);
  }

  next(): void {
    if (!this.complete() || this.roundComplete()) return;
    this.gameIndex.update((value) => value + 1);
    this.loadLine();
  }
}
