import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { CustomButton } from '../../../button/button';

@Component({
  selector: 'app-game-over-dialog',
  imports: [CustomButton],
  template: `
    <dialog #dialog aria-labelledby="game-over-title" (cancel)="dismiss.emit()">
      <h2 id="game-over-title">{{ title() }}</h2>
      <p>{{ detail() }}</p>
      <div class="game-over-actions">
        <button custom-button type="button" autofocus (click)="newGame.emit()">New game…</button>
        <button custom-button type="button" (click)="analyse.emit()">Analyse game</button>
        @if (canSave()) {
          <button custom-button type="button" (click)="save.emit()">Save to repertoire</button>
        }
        <button custom-button type="button" (click)="menu.emit()">Back to menu</button>
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

    .game-over-actions {
      display: grid;
      gap: 16px;
    }

    button {
      cursor: pointer;
    }
  `,
})
export class GameOverDialog {
  readonly title = input.required<string>();
  readonly detail = input('');
  readonly canSave = input(false);
  readonly newGame = output<void>();
  readonly analyse = output<void>();
  readonly save = output<void>();
  readonly menu = output<void>();
  readonly dismiss = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
