import { Component, input, output } from '@angular/core';

@Component({
  selector:'app-game-controls',
  styleUrl: './game-controls.scss',
  template: `
    <ng-content />
    <details #menu class="game-menu" (keydown.escape)="menu.open = false">
      <summary aria-label="Game menu" title="Game menu">
        <span aria-hidden="true">&#x2630;</span>
      </summary>
      <div class="game-menu-actions">
        <button type="button" (click)="menu.open = false; back.emit()">
          Menu
        </button>
        @if (!training()) {
          <button type="button" (click)="menu.open = false; restart.emit()">
            Create New
          </button>
        }
        <button type="button" [disabled]="pending()" (click)="menu.open = false; logout.emit()">
          Log Out
        </button>
      </div>
    </details>
  `,
})
export class GameControls {
  readonly training = input.required<boolean>();
  readonly pending = input(false);
  readonly back = output<void>();
  readonly restart = output<void>();
  readonly logout = output<void>();
}
