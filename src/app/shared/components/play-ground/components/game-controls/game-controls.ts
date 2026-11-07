import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-game-controls',
  styleUrl: '../controls.scss',
  template: `
    <div class="game-toolbar">
      <p role="status" aria-live="polite">{{ status() }}</p>
      <button type="button" class="restart" (click)="back.emit()">Menu</button>
      <button type="button" class="restart" [attr.aria-pressed]="flipped()" (click)="flip.emit()">
        Flip board
      </button>
      @if (!training()) {
        <button type="button" class="restart" (click)="restart.emit()">New game</button>
      }
      @if (!training() && !replaying()) {
        <button type="button" class="restart" [disabled]="!canSave()" (click)="save.emit()">
          Save game
        </button>
      }
    </div>
  `,
})
export class GameControls {
  readonly status = input.required<string>();
  readonly training = input.required<boolean>();
  readonly replaying = input.required<boolean>();
  readonly flipped = input.required<boolean>();
  readonly canSave = input.required<boolean>();
  readonly back = output<void>();
  readonly flip = output<void>();
  readonly restart = output<void>();
  readonly save = output<void>();
}
