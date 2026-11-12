import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomButton } from '../button/button';

@Component({
  selector: 'app-menu-overlay',
  imports: [CustomButton, RouterLink],
  templateUrl: './menu-overlay.html',
  styleUrl: './menu-overlay.scss',
})
export class MenuOverlay {
  readonly username = input('');
  readonly pending = input(false);
  readonly error = input('');
  readonly emailVerified = input(true);
  readonly verificationNotice = input('');
  readonly resendVerification = output<void>();
  readonly checkVerification = output<void>();
  readonly logout = output<void>();
  readonly play = output<void>();
  readonly computer = output<void>();
  readonly library = output<void>();
  readonly deleteAccount = output<string>();

  closeSettings(dialog: HTMLDialogElement, form: HTMLFormElement, deletion: HTMLDetailsElement): void {
    if (this.pending()) return;
    form.reset();
    deletion.open = false;
    dialog.close();
  }

  confirmDeletion(event: Event, form: HTMLFormElement, password: HTMLInputElement): void {
    event.preventDefault();
    if (this.pending() || !form.reportValidity()) return;
    const value = password.value;
    form.reset();
    this.deleteAccount.emit(value);
  }
}
