import { Component, input, output, signal } from '@angular/core';
import { CustomButton } from '../button/button';
import { LegalFooter } from '../legal-footer/legal-footer';
import { LanguageSwitcher } from '../language-switcher/language-switcher';
import { TranslatePipe } from '../../i18n/translate-pipe';

@Component({
  selector: 'app-menu-overlay',
  imports: [CustomButton, LegalFooter, LanguageSwitcher, TranslatePipe],
  templateUrl: './menu-overlay.html',
  styleUrl: './menu-overlay.scss',
})
export class MenuOverlay {
  readonly deletionPasswordVisible = signal(false);
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
    this.deletionPasswordVisible.set(false);
    dialog.close();
  }

  confirmDeletion(event: Event, form: HTMLFormElement, password: HTMLInputElement): void {
    event.preventDefault();
    if (this.pending() || !form.reportValidity()) return;
    const value = password.value;
    form.reset();
    this.deletionPasswordVisible.set(false);
    this.deleteAccount.emit(value);
  }
}
