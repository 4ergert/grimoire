import { Component, input, output } from '@angular/core';
import { Square } from 'chess.js';
import { tr } from '../../../../i18n/i18n';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

export type Promotion = 'q' | 'r' | 'b' | 'n';

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
  readonly square = input.required<Square>();
  readonly choose = output<Promotion>();
  readonly cancel = output<void>();
  readonly promotions: readonly Promotion[] = ['q', 'r', 'b', 'n'];
  readonly pieceNames: Record<Promotion, string> = {
    q: tr('Queen'),
    r: tr('Rook'),
    b: tr('Bishop'),
    n: tr('Knight'),
  };
}
