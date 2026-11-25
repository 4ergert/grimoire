import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, input, output, ViewChild } from '@angular/core';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

/** Collapsible game menu offering back, restart, flip, analysis, settings and logout actions. */
@Component({
  selector: 'app-game-controls',
  imports: [NgTemplateOutlet, TranslatePipe],
  templateUrl: './game-controls.html',
  styleUrl: './game-controls.scss',
})
export class GameControls {
  @ViewChild('menu') private menu?: ElementRef<HTMLDetailsElement>;

  /** Whether a training session is running; hides the restart and analysis entries. */
  readonly training = input.required<boolean>();
  /** Whether a request is in flight; disables the logout entry. */
  readonly pending = input(false);
  /** Whether the current game is against the engine; changes labels and enables analysis. */
  readonly computerGame = input(false);
  /** Whether the user is a guest; hides the logout entry. */
  readonly guest = input(false);
  /** Whether the board is currently flipped. */
  readonly flipped = input(false);
  /** Whether analysis mode is active (exposed as `aria-pressed` on the analysis entry). */
  readonly analysis = input(false);
  /** Emits when the user leaves the game. */
  readonly back = output<void>();
  /** Emits when the user wants to start a new game. */
  readonly restart = output<void>();
  /** Emits when the user logs out. */
  readonly logout = output<void>();
  /** Emits when the user toggles the board orientation. */
  readonly flip = output<void>();
  /** Emits when the user toggles analysis mode. */
  readonly analyse = output<void>();
  /** Emits when the user opens the settings dialog. */
  readonly settings = output<void>();

  /** Closes the menu when a click lands outside of it. */
  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    const menu = this.menu?.nativeElement;
    if (menu?.open && target instanceof Node && !menu.contains(target)) {
      menu.open = false;
    }
  }
}
