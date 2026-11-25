import { Component, input, output } from '@angular/core';
import { Square } from 'chess.js';
import { tr } from '../../../../i18n/i18n';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

/** Piece a pawn can be promoted to, in chess.js notation (queen, rook, bishop, knight). */
export type Promotion = 'q' | 'r' | 'b' | 'n';

/** Prompt that lets the user pick the piece for a pending pawn promotion, or cancel the move. */
@Component({
  selector: 'app-promotion-controls',
  imports: [TranslatePipe],
  styleUrl: '../controls.scss',
  template: `
    <div class="promotion" role="group" [attr.aria-label]="'Choose promotion piece' | t">
      <p>{{ 'Promote pawn on {square}:' | t: { square: square() } }}</p>
      @for (piece of promotions; track piece) {
        <button type="button" (click)="choose.emit(piece)">{{ pieceNames[piece] | t }}</button>
      }
      <button type="button" (click)="cancel.emit()">{{ 'Cancel' | t }}</button>
    </div>
  `,
})
export class PromotionControls {
  /** Destination square of the promoting pawn, shown in the prompt. */
  readonly square = input.required<Square>();
  /** Emits the selected promotion piece. */
  readonly choose = output<Promotion>();
  /** Emits when the user abandons the promotion. */
  readonly cancel = output<void>();
  /** Selectable pieces in display order. */
  readonly promotions: readonly Promotion[] = ['q', 'r', 'b', 'n'];
  /** Translatable display names for each promotion piece. */
  readonly pieceNames: Record<Promotion, string> = {
    q: tr('Queen'),
    r: tr('Rook'),
    b: tr('Bishop'),
    n: tr('Knight'),
  };
}
