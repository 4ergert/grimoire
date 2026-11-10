import { Component, ElementRef, afterNextRender, output, viewChild } from '@angular/core';
import { Color } from 'chess.js';
import { CustomButton } from '../../../button/button';

@Component({
  selector: 'app-engine-side-dialog',
  imports: [CustomButton],
  template: `
    <dialog #dialog aria-labelledby="engine-side-title" (cancel)="cancel.emit()">
      <h2 id="engine-side-title">Play against Stockfish</h2>
      <p>Choose your side.</p>
      <div class="side-actions">
        <button custom-button type="button" autofocus (click)="choose.emit('w')">
          Play as White
        </button>
        <button custom-button type="button" (click)="choose.emit('b')">Play as Black</button>
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

    button {
      cursor: pointer;
    }
  `,
})
export class EngineSideDialog {
  readonly choose = output<Color>();
  readonly cancel = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
