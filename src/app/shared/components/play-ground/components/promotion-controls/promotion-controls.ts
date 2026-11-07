import { Component, input, output } from '@angular/core';
import { Square } from 'chess.js';

export type Promotion = 'q' | 'r' | 'b' | 'n';

@Component({
  selector: 'app-promotion-controls',
  styleUrl: '../controls.scss',
  template: `
    <div class="promotion" role="group" aria-label="Choose promotion piece">
      <p>Promote pawn on {{ square() }}:</p>
      @for (piece of promotions; track piece) {
        <button type="button" (click)="choose.emit(piece)">{{ pieceNames[piece] }}</button>
      }
      <button type="button" (click)="cancel.emit()">Cancel</button>
    </div>
  `,
})
export class PromotionControls {
  readonly square = input.required<Square>();
  readonly choose = output<Promotion>();
  readonly cancel = output<void>();
  readonly promotions: readonly Promotion[] = ['q', 'r', 'b', 'n'];
  readonly pieceNames: Record<Promotion, string> = {
    q: 'Queen',
    r: 'Rook',
    b: 'Bishop',
    n: 'Knight',
  };
}
