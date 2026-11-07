import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-replay-controls',
  styleUrl: '../controls.scss',
  template: `
    <nav class="game-toolbar" aria-label="Replay controls">
      <button class="restart" type="button" [disabled]="index() === 0" (click)="navigate.emit(0)">
        Start
      </button>
      <button
        class="restart"
        type="button"
        [disabled]="index() === 0"
        (click)="navigate.emit(index() - 1)"
      >
        Previous
      </button>
      <span role="status"
        >{{ index() }} / {{ moves().length }} {{ moves()[index() - 1] || '' }}</span
      >
      <button
        class="restart"
        type="button"
        [disabled]="index() === moves().length"
        (click)="navigate.emit(index() + 1)"
      >
        Next
      </button>
      <button
        class="restart"
        type="button"
        [disabled]="index() === moves().length"
        (click)="navigate.emit(moves().length)"
      >
        End
      </button>
    </nav>
  `,
})
export class ReplayControls {
  readonly index = input.required<number>();
  readonly moves = input.required<string[]>();
  readonly navigate = output<number>();
}
