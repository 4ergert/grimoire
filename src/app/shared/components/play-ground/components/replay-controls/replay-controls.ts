import { Component, input, output } from '@angular/core';
import { CustomButton } from '../../../button/button';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

@Component({
  selector: 'app-replay-controls',
  styleUrls: ['../controls.scss', './replay-controls.scss'],
  imports: [CustomButton, TranslatePipe],
  template: `
    <nav class="game-toolbar" [attr.aria-label]="'Move navigation' | t">
      <button
        custom-button
        class="restart"
        type="button"
        [attr.aria-label]="'Start' | t"
        [attr.title]="'Start' | t"
        [disabled]="index() === 0"
        (click)="navigate.emit(0)"
      >
        <span aria-hidden="true">&#x23EE;</span>
      </button>
      <button
        custom-button
        class="restart"
        type="button"
        [attr.aria-label]="'Previous move' | t"
        [attr.title]="'Previous move' | t"
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
        [attr.aria-label]="'Next move' | t"
        [attr.title]="'Next move' | t"
        [disabled]="index() === moves().length"
        (click)="navigate.emit(index() + 1)"
      >
        <span aria-hidden="true">&#x2192;</span>
      </button>
      <button
        custom-button
        class="restart"
        type="button"
        [attr.aria-label]="'End' | t"
        [attr.title]="'End' | t"
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
