import { Component, ElementRef, HostListener, input, output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-game-controls',
  styleUrl: './game-controls.scss',
  template: `
    <ng-content />
    <details #menu class="game-menu" (keydown.escape)="menu.open = false">
      <summary aria-label="Game menu" title="Game menu">
        <span aria-hidden="true">&#x2630;</span>
      </summary>
      <div class="game-menu-actions">
        <button type="button" (click)="menu.open = false; back.emit()">Menu</button>
        <button
          type="button"
          aria-label="Flip board"
          [attr.aria-pressed]="flipped()"
          (click)="menu.open = false; flip.emit()"
        >
          Flip board
        </button>
        @if (!training()) {
          <button type="button" (click)="menu.open = false; restart.emit()">
            {{ computerGame() ? 'New game' : 'Create New' }}
          </button>
        }
        @if (!guest()) {
          <button type="button" [disabled]="pending()" (click)="menu.open = false; logout.emit()">
            Log Out
          </button>
        }
      </div>
    </details>
  `,
})
export class GameControls {
  @ViewChild('menu') private menu?: ElementRef<HTMLDetailsElement>;

  readonly training = input.required<boolean>();
  readonly pending = input(false);
  readonly computerGame = input(false);
  readonly guest = input(false);
  readonly flipped = input(false);
  readonly back = output<void>();
  readonly restart = output<void>();
  readonly logout = output<void>();
  readonly flip = output<void>();

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    const menu = this.menu?.nativeElement;
    if (menu?.open && target instanceof Node && !menu.contains(target)) {
      menu.open = false;
    }
  }
}
