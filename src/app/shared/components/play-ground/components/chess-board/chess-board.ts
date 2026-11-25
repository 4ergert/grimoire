import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Chess, Color, PieceSymbol, Square, SQUARES } from 'chess.js';
import { BoardThemeService } from '../../../../services/board-theme';
import { tr } from '../../../../i18n/i18n';
import { TranslatePipe } from '../../../../i18n/translate-pipe';
import { BoardMotion } from './board-motion';

const DRAG_THRESHOLD = 5;
// Frames to wait for the parent to confirm the selection before a drag is given up.
const SELECTION_WAIT_MOVES = 10;

interface Press {
  square: Square;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  piece: HTMLElement;
  requested: boolean;
  active: boolean;
  waited: number;
}

@Component({
  selector: 'app-chess-board',
  imports: [BoardMotion, TranslatePipe],
  templateUrl: './chess-board.html',
  styleUrl: './chess-board.scss',
  host: {
    '[style.--square-dark]': 'theme().dark',
    '[style.--square-light]': 'theme().light',
  },
})
export class ChessBoard {
  private readonly document = inject(DOCUMENT);
  private press: Press | null = null;
  private suppressClick = false;
  readonly theme = inject(BoardThemeService).theme;
  readonly dragSquare = signal<Square | null>(null);
  readonly drops = signal(0);
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
  readonly pieceLabels: Record<Color, Record<PieceSymbol, string>> = {
    w: {
      k: tr('White King'),
      q: tr('White Queen'),
      r: tr('White Rook'),
      b: tr('White Bishop'),
      n: tr('White Knight'),
      p: tr('White Pawn'),
    },
    b: {
      k: tr('Black King'),
      q: tr('Black Queen'),
      r: tr('Black Rook'),
      b: tr('Black Bishop'),
      n: tr('Black Knight'),
      p: tr('Black Pawn'),
    },
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

  squareClicked(square: Square): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.squareSelected.emit(square);
  }

  dragStart(event: PointerEvent): void {
    this.press = null;
    if (this.disabled() || event.button !== 0 || !event.isPrimary) return;
    const button = (event.target as Element).closest<HTMLElement>('[data-square]');
    const piece = button?.querySelector<HTMLElement>('.piece');
    if (!button || !piece) return;
    const rect = button.getBoundingClientRect();
    this.press = {
      square: button.dataset['square'] as Square,
      x: event.clientX,
      y: event.clientY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      piece,
      requested: false,
      active: false,
      waited: 0,
    };
  }

  dragMove(event: PointerEvent): void {
    const press = this.press;
    if (!press) return;
    if (!press.active) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
      // A piece that can be captured by the selected piece is clicked, never dragged.
      if (this.targets().includes(press.square)) {
        this.press = null;
        return;
      }
      if (this.selected() !== press.square) {
        if (!press.requested) {
          press.requested = true;
          this.squareSelected.emit(press.square);
        } else if (++press.waited > SELECTION_WAIT_MOVES) {
          this.press = null;
        }
        return;
      }
      press.active = true;
      this.dragSquare.set(press.square);
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }
    const dx = event.clientX - press.centerX;
    const dy = event.clientY - press.centerY;
    press.piece.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
  }

  dragEnd(event: PointerEvent): void {
    const press = this.press;
    this.press = null;
    if (!press) return;
    if (!press.active) {
      // The selection requested by an aborted drag must survive the click that follows.
      if (press.requested) this.keepNextClickFromToggling();
      return;
    }
    press.piece.style.transform = '';
    this.dragSquare.set(null);
    this.keepNextClickFromToggling();
    const target = this.squareAtPoint(event.clientX, event.clientY);
    if (target && target !== press.square && this.targets().includes(target)) {
      this.drops.update((count) => count + 1);
      this.squareSelected.emit(target);
    }
  }

  dragCancel(): void {
    const press = this.press;
    this.press = null;
    if (!press?.active) return;
    press.piece.style.transform = '';
    this.dragSquare.set(null);
  }

  squareAtPoint(x: number, y: number): Square | null {
    const element = this.document.elementFromPoint(x, y);
    return (element?.closest('[data-square]')?.getAttribute('data-square') as Square) ?? null;
  }

  private keepNextClickFromToggling(): void {
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false));
  }
}
