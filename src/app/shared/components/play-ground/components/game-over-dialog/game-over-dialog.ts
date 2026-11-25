import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { CustomButton } from '../../../button/button';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

/** Modal dialog shown when a game ends, offering follow-up actions; opens itself after the first render. */
@Component({
  selector: 'app-game-over-dialog',
  imports: [CustomButton, TranslatePipe],
  template: `
    <dialog #dialog aria-labelledby="game-over-title" (cancel)="dismiss.emit()">
      <h2 id="game-over-title">{{ title() }}</h2>
      <p>{{ detail() }}</p>
      <div class="game-over-actions">
        <button custom-button type="button" autofocus (click)="newGame.emit()">
          {{ 'New game…' | t }}
        </button>
        <button custom-button type="button" (click)="analyse.emit()">{{ 'Analyse game' | t }}</button>
        @if (canSave()) {
          <button custom-button type="button" (click)="save.emit()">
            {{ 'Save to repertoire' | t }}
          </button>
        }
        <button custom-button type="button" (click)="menu.emit()">{{ 'Back to menu' | t }}</button>
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
  /** Headline describing the result. */
  readonly title = input.required<string>();
  /** Optional additional explanation of the result. */
  readonly detail = input('');
  /** Whether the "Save to repertoire" action is offered. */
  readonly canSave = input(false);
  /** Emits when the user wants to start a new game. */
  readonly newGame = output<void>();
  /** Emits when the user wants to analyse the finished game. */
  readonly analyse = output<void>();
  /** Emits when the user wants to save the game to the repertoire. */
  readonly save = output<void>();
  /** Emits when the user wants to return to the menu. */
  readonly menu = output<void>();
  /** Emits when the dialog is dismissed without choosing an action (e.g. Escape). */
  readonly dismiss = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
