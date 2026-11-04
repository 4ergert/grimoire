import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-menu-overlay',
  imports: [],
  templateUrl: './menu-overlay.html',
  styleUrl: './menu-overlay.scss',
})
export class MenuOverlay {
  readonly username = input('');
  readonly pending = input(false);
  readonly error = input('');
  readonly logout = output<void>();
  readonly play = output<void>();
}
