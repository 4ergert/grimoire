import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, input, output, ViewChild } from '@angular/core';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

@Component({
  selector: 'app-game-controls',
  imports: [NgTemplateOutlet, TranslatePipe],
  templateUrl: './game-controls.html',
  styleUrl: './game-controls.scss',
})
export class GameControls {
  @ViewChild('menu') private menu?: ElementRef<HTMLDetailsElement>;

  readonly training = input.required<boolean>();
  readonly pending = input(false);
  readonly computerGame = input(false);
  readonly guest = input(false);
  readonly flipped = input(false);
  readonly analysis = input(false);
  readonly back = output<void>();
  readonly restart = output<void>();
  readonly logout = output<void>();
  readonly flip = output<void>();
  readonly analyse = output<void>();
  readonly settings = output<void>();

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    const menu = this.menu?.nativeElement;
    if (menu?.open && target instanceof Node && !menu.contains(target)) {
      menu.open = false;
    }
  }
}
