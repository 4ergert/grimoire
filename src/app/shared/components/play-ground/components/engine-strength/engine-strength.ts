import { Component, model } from '@angular/core';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

/** Select box for the engine level; supports two-way binding via `[(strength)]`. */
@Component({
  selector: 'app-engine-strength',
  imports: [TranslatePipe],
  template: `
    <label for="engine-strength">{{ 'Level (1–10)' | t }}</label>
    <select id="engine-strength" #strengthSelect (change)="strength.set(+strengthSelect.value)">
      @for (level of levels; track level) {
        <option [value]="level" [selected]="level === strength()">{{ level }}</option>
      }
    </select>
  `,
  styles: `
    :host {
      display: block;
    }

    select {
      width: 100%;
      display: block;
      margin: 8px auto 20px;
      padding: 15px 32px;
      border: none;
      background-image: linear-gradient(to right, #190a059a 10%, #ffffff3c 100%);
      background-color: transparent;
      background-size: 200% auto;
      color: rgba(255, 255, 255, 0.781);
      box-shadow: 0 0 5px #000000;
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 3px;
      text-align: center;
      text-transform: uppercase;
      transition: 0.5s;
      cursor: pointer;
    }

    select:hover {
      background-position: right center;
      color: #fefefe;
      text-shadow: 0 0 5px #000000;
      box-shadow: 0 0 15px #ffffff;
    }

    select:focus-visible {
      outline: 2px solid #ffdfbc;
      outline-offset: 3px;
    }
  `,
})
export class EngineStrength {
  /** Selected engine level (1–10). */
  readonly strength = model(1);
  /** Selectable levels. */
  readonly levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}
