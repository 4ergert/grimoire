import { computed, signal } from '@angular/core';
import { Chess, Square } from 'chess.js';

export interface GameTurn {
  number: number;
  white: string;
  black: string;
}

export class GameSession {
  private readonly game = new Chess();
  readonly position = signal(this.game.fen());
  readonly positions = computed(() => {
    this.position();
    const moves = this.game.history({ verbose: true });
    return [moves[0]?.before ?? this.game.fen(), ...moves.map((move) => move.after)];
  });
  readonly enginePosition = computed(() => {
    this.position();
    const moves = this.game.history({ verbose: true });
    const start = moves[0]?.before ?? this.game.fen();
    const line = moves.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`).join(' ');
    return `fen ${start}${line ? ` moves ${line}` : ''}`;
  });
  readonly history = computed(() => {
    this.position();
    const turns: GameTurn[] = [];
    for (const move of this.game.history({ verbose: true })) {
      const number = Number(move.before.split(' ')[5]);
      let turn = turns[turns.length - 1];
      if (!turn || turn.number !== number) {
        turn = { number, white: '', black: '' };
        turns.push(turn);
      }
      if (move.color === 'w') turn.white = move.san;
      else turn.black = move.san;
    }
    return turns;
  });
  readonly status = computed(() => {
    this.position();
    const player = this.game.turn() === 'w' ? 'White' : 'Black';
    if (this.game.isCheckmate())
      return `Checkmate! ${player === 'White' ? 'Black' : 'White'} wins.`;
    if (this.game.isStalemate()) return 'Draw by stalemate.';
    if (this.game.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (this.game.isThreefoldRepetition()) return 'Draw by threefold repetition.';
    if (this.game.isDrawByFiftyMoves()) return 'Draw by the fifty-move rule.';
    return `${player} to move${this.game.isCheck() ? ' - Check!' : '.'}`;
  });

  get(square: Square) {
    return this.game.get(square);
  }
  turn() {
    return this.game.turn();
  }
  isGameOver() {
    return this.game.isGameOver();
  }
  moves(square: Square) {
    return this.game.moves({ square, verbose: true });
  }
  move(from: Square, to: Square, promotion?: string): void {
    this.game.move({ from, to, promotion });
    this.position.set(this.game.fen());
  }
  reset(): void {
    this.game.reset();
    this.position.set(this.game.fen());
  }
  pgn(): string {
    this.game.setHeader('Event', 'Grimoire local game');
    this.game.setHeader(
      'Result',
      this.game.isCheckmate()
        ? this.game.turn() === 'w'
          ? '0-1'
          : '1-0'
        : this.game.isDraw()
          ? '1/2-1/2'
          : '*',
    );
    return this.game.pgn();
  }
}
