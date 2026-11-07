import { Component, input, output } from '@angular/core';
import { CustomButton } from '../../../button/button';

@Component({
  selector:'app-game-controls',
  imports: [CustomButton],
  styleUrl: '../controls.scss',
  template: `
    <div class="game-toolbar">
      <button custom-button type="button" class="restart" (click)="back.emit()">
        Menu
      </button>
      @if (!training()) {
        <button custom-button type="button" class="restart" (click)="restart.emit()">
          New game
        </button>
      }
    </div>
  `,
})
export class GameControls {
  readonly training = input.required<boolean>();
  readonly back = output<void>();
  readonly restart = output<void>();
}
