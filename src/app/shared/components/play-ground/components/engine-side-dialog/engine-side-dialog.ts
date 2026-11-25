import { Component, ElementRef, afterNextRender, output, signal, viewChild } from '@angular/core';
import { Color } from 'chess.js';
import { CustomButton } from '../../../button/button';
import { EngineStrength } from '../engine-strength/engine-strength';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

export interface EngineGameOptions {
  color: Color;
  strength: number;
}

@Component({
  selector: 'app-engine-side-dialog',
  imports: [CustomButton, EngineStrength, TranslatePipe],
  template: `
    <dialog #dialog aria-labelledby="engine-side-title" (cancel)="cancel.emit()">
      <h2 id="engine-side-title">{{ 'Play against Stockfish' | t }}</h2>
      <p>{{ 'Choose your side.' | t }}</p>
      <app-engine-strength [(strength)]="strength" />
      <div class="side-actions">
        <button
          custom-button
          type="button"
          autofocus
          (click)="choose.emit({ color: 'w', strength: strength() })"
        >
          {{ 'Play as White' | t }}
        </button>
        <button
          custom-button
          type="button"
          (click)="choose.emit({ color: 'b', strength: strength() })"
        >
          {{ 'Play as Black' | t }}
        </button>
        <button custom-button type="button" (click)="cancel.emit()">{{ 'Back' | t }}</button>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      box-sizing: border-box;
      width: min(420px, calc(100% - 32px));
      padding: 24px;
      border: 1px solid #ffdfbc90;
      background: #232323;
      color: #ffdfbc;
      text-align: center;
    }

    dialog::backdrop {
      background: #000000b3;
    }

    h2 {
      margin-top: 0;
    }

    .side-actions {
      display: grid;
      gap: 16px;
    }

    button {
      cursor: pointer;
    }
  `,
})
export class EngineSideDialog {
  readonly choose = output<EngineGameOptions>();
  readonly strength = signal(1);
  readonly cancel = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
