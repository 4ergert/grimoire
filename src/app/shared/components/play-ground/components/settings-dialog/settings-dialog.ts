import { Component, ElementRef, afterNextRender, inject, output, viewChild } from '@angular/core';
import { BoardThemeService } from '../../../../services/board-theme';
import { CustomButton } from '../../../button/button';

@Component({
  selector: 'app-settings-dialog',
  imports: [CustomButton],
  template: `
    <dialog #dialog aria-labelledby="settings-title" (cancel)="close.emit()">
      <h2 id="settings-title">Settings</h2>
      <div
        class="preview"
        aria-hidden="true"
        [style.--preview-dark]="themes.theme().dark"
        [style.--preview-light]="themes.theme().light"
      >
        <span></span><span></span><span></span><span></span>
      </div>
      <p role="status">Board colors: {{ themes.theme().name }}</p>
      <div class="settings-actions">
        <button custom-button type="button" autofocus (click)="themes.next()">
          Change board colors
        </button>
        <button custom-button type="button" (click)="close.emit()">Close</button>
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

    .preview {
      display: grid;
      grid-template: repeat(2, 40px) / repeat(2, 40px);
      width: 80px;
      margin: 0 auto;
      border: 1px solid #ffdfbc90;
      background: #6a6a6a;

      span:nth-child(4n + 1),
      span:nth-child(4n + 4) {
        background: var(--preview-light);
      }

      span:nth-child(4n + 2),
      span:nth-child(4n + 3) {
        background: var(--preview-dark);
      }
    }

    .settings-actions {
      display: grid;
      gap: 16px;
    }

    button {
      cursor: pointer;
    }
  `,
})
export class SettingsDialog {
  readonly themes = inject(BoardThemeService);
  readonly close = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
