import { Component, input, output } from '@angular/core';
import { CustomButton } from '../../../button/button';

@Component({
  selector: 'app-replay-controls',
  styleUrls: ['../controls.scss', './replay-controls.scss'],
  imports: [CustomButton],
  template: `
    <nav class="game-toolbar" aria-label="Move navigation">
      <button
        custom-button
        class="restart"
        type="button"
        aria-label="Start"
        title="Start"
        [disabled]="index() === 0"
        (click)="navigate.emit(0)"
      >
        <span aria-hidden="true">&#x23EE;</span>
      </button>
      <button
        custom-button
        class="restart"
        type="button"
        aria-label="Previous move"
        title="Previous move"
        [disabled]="index() === 0"
        (click)="navigate.emit(index() - 1)"
      >
        <span aria-hidden="true">&#x2190;</span>
      </button>
      <span role="status"
        >{{ index() }}/{{ moves().length }} </span
      >
      <button
        custom-button
        class="restart"
        type="button"
        aria-label="Next move"
        title="Next move"
        [disabled]="index() === moves().length"
        (click)="navigate.emit(index() + 1)"
      >
        <span aria-hidden="true">&#x2192;</span>
      </button>
      <button
        custom-button
        class="restart"
        type="button"
        aria-label="End"
        title="End"
        [disabled]="index() === moves().length"
        (click)="navigate.emit(moves().length)"
      >
        <span aria-hidden="true">&#x23ED;</span>
      </button>
    </nav>
  `,
})
export class ReplayControls {
  readonly index = input.required<number>();
  readonly moves = input.required<string[]>();
  readonly navigate = output<number>();
}
