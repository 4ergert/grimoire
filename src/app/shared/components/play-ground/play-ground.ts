import { Component, computed, signal } from '@angular/core';
import { Chess, Color, PieceSymbol, Square, SQUARES } from 'chess.js';

type Promotion = 'q' | 'r' | 'b' | 'n';

@Component({
  selector: 'app-play-ground',
  imports: [],
  templateUrl: './play-ground.html',
  styleUrl: './play-ground.scss',
})
export class PlayGround {
  readonly ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  readonly files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  readonly squares = SQUARES;
  private readonly game = new Chess();
  private readonly position = signal(this.game.fen());
  readonly selected = signal<Square | null>(null);
  readonly promotion = signal<{ from: Square; to: Square } | null>(null);
  readonly promotions: readonly Promotion[] = ['q', 'r', 'b', 'n'];
  readonly pieceNames: Record<PieceSymbol, string> = {
    k: 'King',
    q: 'Queen',
    r: 'Rook',
    b: 'Bishop',
    n: 'Knight',
    p: 'Pawn',
  };
  readonly board = computed(() => new Chess(this.position()).board());
  readonly legalTargets = computed(() => {
    const square = this.selected();
    return square
      ? new Chess(this.position()).moves({ square, verbose: true }).map((move) => move.to)
      : [];
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

  pieceGlyph(type: PieceSymbol, color: Color): string {
    const glyphs = {
      w: { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' },
      b: { k: '\u265a', q: '\u265b', r: '\u265c', b: '\u265d', n: '\u265e', p: '\u265f' },
    };
    return glyphs[color][type];
  }

  select(square: Square): void {
    if (this.game.isGameOver() || this.promotion()) return;
    const from = this.selected();
    if (from && this.legalTargets().includes(square)) {
      const moves = this.game
        .moves({ square: from, verbose: true })
        .filter((move) => move.to === square);
      if (moves.some((move) => move.isPromotion())) {
        this.promotion.set({ from, to: square });
      } else {
        this.game.move({ from, to: square });
        this.updatePosition();
      }
      return;
    }
    const piece = this.game.get(square);
    this.selected.set(piece?.color === this.game.turn() && square !== from ? square : null);
  }

  promote(piece: Promotion): void {
    const move = this.promotion();
    if (!move) return;
    this.game.move({ ...move, promotion: piece });
    this.updatePosition();
  }

  restart(): void {
    this.game.reset();
    this.updatePosition();
  }

  private updatePosition(): void {
    this.position.set(this.game.fen());
    this.selected.set(null);
    this.promotion.set(null);
  }
}
