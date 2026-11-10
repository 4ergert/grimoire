import { Component, ElementRef, afterNextRender, output, signal, viewChild } from '@angular/core';
import { Color } from 'chess.js';
import { CustomButton } from '../../../button/button';

export interface EngineGameOptions {
  color: Color;
  strength: number;
}

@Component({
  selector: 'app-engine-side-dialog',
  imports: [CustomButton],
  template: `
    <dialog #dialog aria-labelledby="engine-side-title" (cancel)="cancel.emit()">
      <h2 id="engine-side-title">Play against Stockfish</h2>
      <p>Choose your side.</p>
      <label for="engine-strength">Strength (1–10)</label>
      <select id="engine-strength" #strengthSelect (change)="strength.set(+strengthSelect.value)">
        @for (level of levels; track level) {
          <option [value]="level" [selected]="level === strength()">{{ level }}</option>
        }
      </select>
      <div class="side-actions">
        <button
          custom-button
          type="button"
          autofocus
          (click)="choose.emit({ color: 'w', strength: strength() })"
        >
          Play as White
        </button>
        <button
          custom-button
          type="button"
          (click)="choose.emit({ color: 'b', strength: strength() })"
        >
          Play as Black
        </button>
        <button custom-button type="button" (click)="cancel.emit()">Back</button>
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

    select {
      display: block;
      margin: 8px auto 20px;
      padding: 8px 12px;
      font: inherit;
    }

    button {
      cursor: pointer;
    }
  `,
})
export class EngineSideDialog {
  readonly choose = output<EngineGameOptions>();
  readonly strength = signal(5);
  readonly levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly cancel = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
