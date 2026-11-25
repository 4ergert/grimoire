import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Chess, Color, PieceSymbol, Square, SQUARES } from 'chess.js';
import { BoardThemeService } from '../../../../services/board-theme';
import { tr } from '../../../../i18n/i18n';
import { TranslatePipe } from '../../../../i18n/translate-pipe';
import { BoardMotion } from './board-motion';

/** Distance in pixels the pointer must travel before a press counts as a drag. */
const DRAG_THRESHOLD = 5;
// Frames to wait for the parent to confirm the selection before a drag is given up.
const SELECTION_WAIT_MOVES = 10;

/** In-progress pointer press on a piece, tracked until it turns into a drag or is released. */
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

/**
 * Interactive 8x8 board with click-to-move and drag-and-drop input, orientation flipping,
 * move highlights and an evaluation bar. It only reports squares; move legality is up to the parent.
 */
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
  /** Square currently being dragged, or `null` when no drag is active. */
  readonly dragSquare = signal<Square | null>(null);
  /** Counts pieces dropped onto a target square, so {@link BoardMotion} skips animating those moves. */
  readonly drops = signal(0);
  /** Position to render as FEN. */
  readonly position = input.required<string>();
  /** Whether the board is shown from Black's side. */
  readonly flipped = input(false);
  /** Currently selected square, if any. */
  readonly selected = input<Square | null>(null);
  /** Legal destination squares of the selected piece; dropping or clicking there emits a selection. */
  readonly targets = input<readonly Square[]>([]);
  /** Square to highlight as a hint. */
  readonly hint = input<Square | null>(null);
  /** Disables all board interaction. */
  readonly disabled = input(false);
  /** Engine evaluation in centipawns from White's perspective, or `null` when unavailable. */
  readonly evaluation = input<number | null>(null);
  /** Human-readable evaluation text shown next to the bar. */
  readonly evaluationLabel = input('');
  /** Emits a square the user clicked or dropped a piece on. */
  readonly squareSelected = output<Square>();
  /** White's share of the evaluation bar in percent: a logistic curve of the evaluation clamped to ±2000, 50 when unknown. */
  readonly whiteAdvantage = computed(() => {
    const evaluation = this.evaluation();
    if (evaluation === null) return 50;
    const score = Math.max(-2000, Math.min(2000, evaluation));
    return 100 / (1 + Math.exp(-score / 400));
  });
  /** Rank labels in display order. */
  readonly ranks = computed(() =>
    this.flipped() ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1],
  );
  /** File labels in display order. */
  readonly files = computed(() =>
    this.flipped()
      ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
      : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  );
  /** Square names in display order (top-left to bottom-right). */
  readonly squares = computed(() => (this.flipped() ? [...SQUARES].reverse() : SQUARES));
  /** Piece grid of the current position, rows and columns ordered for the current orientation. */
  readonly board = computed(() => {
    const board = new Chess(this.position()).board();
    return this.flipped() ? board.map((row) => [...row].reverse()).reverse() : board;
  });
  /** Translatable accessible names for every piece, by color and type. */
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

  /** Returns the URL of the SVG image for the given piece. */
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

  /** Handles a click on a square; ignores the click that directly follows a drag. */
  squareClicked(square: Square): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.squareSelected.emit(square);
  }

  /** Records a primary-button press on a piece as a potential drag start. */
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

  /**
   * Promotes a press to a drag once the pointer passes the threshold, then moves the piece with the pointer.
   * An unselected piece is first reported via `squareSelected` and the drag waits for the parent to select it.
   */
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

  /** Finishes a drag and emits the drop square if it is one of the current targets. */
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

  /** Aborts an active drag without moving anything. */
  dragCancel(): void {
    const press = this.press;
    this.press = null;
    if (!press?.active) return;
    press.piece.style.transform = '';
    this.dragSquare.set(null);
  }

  /** Returns the board square under the given viewport coordinates, or `null` if none. */
  squareAtPoint(x: number, y: number): Square | null {
    const element = this.document.elementFromPoint(x, y);
    return (element?.closest('[data-square]')?.getAttribute('data-square') as Square) ?? null;
  }

  private keepNextClickFromToggling(): void {
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false));
  }
}
