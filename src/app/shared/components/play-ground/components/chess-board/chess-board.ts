import { Component, computed, input, output } from '@angular/core';
import { Chess, Color, PieceSymbol, Square, SQUARES } from 'chess.js';
import { BoardMotion } from './board-motion';

@Component({
  selector: 'app-chess-board',
  imports: [BoardMotion],
  templateUrl: './chess-board.html',
  styleUrl: './chess-board.scss',
})
export class ChessBoard {
  readonly position = input.required<string>();
  readonly flipped = input(false);
  readonly selected = input<Square | null>(null);
  readonly targets = input<readonly Square[]>([]);
  readonly hint = input<Square | null>(null);
  readonly disabled = input(false);
  readonly evaluation = input<number | null>(null);
  readonly evaluationLabel = input('');
  readonly squareSelected = output<Square>();
  readonly whiteAdvantage = computed(() => {
    const evaluation = this.evaluation();
    if (evaluation === null) return 50;
    const score = Math.max(-2000, Math.min(2000, evaluation));
    return 100 / (1 + Math.exp(-score / 400));
  });
  readonly ranks = computed(() =>
    this.flipped() ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1],
  );
  readonly files = computed(() =>
    this.flipped()
      ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
      : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  );
  readonly squares = computed(() => (this.flipped() ? [...SQUARES].reverse() : SQUARES));
  readonly board = computed(() => {
    const board = new Chess(this.position()).board();
    return this.flipped() ? board.map((row) => [...row].reverse()).reverse() : board;
  });
  readonly pieceNames: Record<PieceSymbol, string> = {
    k: 'King',
    q: 'Queen',
    r: 'Rook',
    b: 'Bishop',
    n: 'Knight',
    p: 'Pawn',
  };

  pieceImagePath(type: PieceSymbol, color: Color): string {
    const colorName = color === 'w' ? 'white' : 'black';
    const pieceNames: Record<PieceSymbol, string> = {
      k: 'king',
      q: 'queen',
      r: 'rook',
      b: 'bishop',
      n: 'knight',
      p: 'pawn',
    };
    return `/img/chess-pieces/${colorName}-${pieceNames[type]}.svg`;
  }
}
