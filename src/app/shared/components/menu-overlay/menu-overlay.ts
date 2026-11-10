import { Component, input, output } from '@angular/core';
import { CustomButton } from '../button/button';

@Component({
  selector: 'app-menu-overlay',
  imports: [CustomButton],
  templateUrl: './menu-overlay.html',
  styleUrl: './menu-overlay.scss',
})
export class MenuOverlay {
  readonly username = input('');
  readonly pending = input(false);
  readonly error = input('');
  readonly logout = output<void>();
  readonly play = output<void>();
  readonly computer = output<void>();
  readonly library = output<void>();
}
