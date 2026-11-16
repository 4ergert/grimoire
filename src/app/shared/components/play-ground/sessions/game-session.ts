import { computed, signal } from '@angular/core';
import { Chess, Move, Square } from 'chess.js';

export interface GameTurn {
  number: number;
  white: string;
  black: string;
}

export class GameSession {
  private readonly game = new Chess();
  private readonly redoMoves: Move[] = [];
  readonly position = signal(this.game.fen());
  readonly cursor = computed(() => {
    this.position();
    return this.game.history().length;
  });
  readonly timelineMoves = computed(() => {
    this.position();
    return [
      ...this.game.history({ verbose: true }).map((move) => move.san),
      ...this.redoMoves.map((move) => move.san),
    ];
  });
  readonly positions = computed(() => {
    this.position();
    const moves = this.game.history({ verbose: true });
    const positions = [moves[0]?.before ?? this.game.fen(), ...moves.map((move) => move.after)];
    const replay = new Chess(this.game.fen());
    for (const move of this.redoMoves) {
      positions.push(
        replay.move({ from: move.from, to: move.to, promotion: move.promotion }).after,
      );
    }
    return positions;
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
    this.redoMoves.length = 0;
    this.position.set(this.game.fen());
  }
  navigate(index: number): void {
    const target = Math.max(0, Math.min(this.timelineMoves().length, Math.trunc(index)));
    while (this.game.history().length > target) {
      const move = this.game.undo();
      if (move) this.redoMoves.unshift(move);
    }
    while (this.game.history().length < target) {
      const move = this.redoMoves.shift();
      if (!move) break;
      this.game.move({ from: move.from, to: move.to, promotion: move.promotion });
    }
    this.position.set(this.game.fen());
  }
  reset(): void {
    this.game.reset();
    this.redoMoves.length = 0;
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
