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
/**
 * Main menu shown to a signed-in user: navigation buttons, e-mail verification prompts,
 * and a settings dialog with account deletion. It holds no auth logic and reports user
 * intent through outputs.
 */
export class MenuOverlay {
  /** Whether the deletion password field is shown as plain text. */
  readonly deletionPasswordVisible = signal(false);
  /** Name shown in the welcome message. */
  readonly username = input('');
  /** True while a parent-driven operation runs; disables the controls. */
  readonly pending = input(false);
  /** Error message to display (translated by the template); empty for none. */
  readonly error = input('');
  /** When false, only the verification actions are offered instead of the game menu buttons. */
  readonly emailVerified = input(true);
  /** Status text shown after a verification action; empty for none. */
  readonly verificationNotice = input('');
  /** Emits when the user asks for the verification e-mail to be sent again. */
  readonly resendVerification = output<void>();
  /** Emits when the user states the e-mail is verified and wants it re-checked. */
  readonly checkVerification = output<void>();
  readonly logout = output<void>();
  /** Emits when the user chooses "Create". */
  readonly play = output<void>();
  /** Emits when the user chooses to play against Stockfish. */
  readonly computer = output<void>();
  /** Emits when the user opens the repertoire. */
  readonly library = output<void>();
  /** Emits the entered current password when the user confirms account deletion. */
  readonly deleteAccount = output<string>();

  /**
   * Closes the settings dialog and resets its deletion form and state.
   * Does nothing while an operation is pending.
   * @param dialog - The settings dialog to close.
   * @param form - The deletion form to reset.
   * @param deletion - The collapsible deletion section to collapse.
   */
  closeSettings(dialog: HTMLDialogElement, form: HTMLFormElement, deletion: HTMLDetailsElement): void {
    if (this.pending()) return;
    form.reset();
    deletion.open = false;
    this.deletionPasswordVisible.set(false);
    dialog.close();
  }

  /**
   * Submit handler for the deletion form: validates it, then emits {@link deleteAccount}
   * with the entered password and clears the form. Ignored while pending or when invalid.
   */
  confirmDeletion(event: Event, form: HTMLFormElement, password: HTMLInputElement): void {
    event.preventDefault();
    if (this.pending() || !form.reportValidity()) return;
    const value = password.value;
    form.reset();
    this.deletionPasswordVisible.set(false);
    this.deleteAccount.emit(value);
  }
}
