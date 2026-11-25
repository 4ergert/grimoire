import { Component, ElementRef, afterNextRender, output, viewChild } from '@angular/core';
import { CustomButton } from '../button/button';
import { TranslatePipe } from '../../i18n/translate-pipe';

@Component({
  selector: 'app-about-dialog',
  imports: [CustomButton, TranslatePipe],
  templateUrl: './about-dialog.html',
  styleUrl: './about-dialog.scss',
})
/** Modal "about" dialog; opens itself as a modal after the first render. */
export class AboutDialog {
  /** Emits when the dialog should be dismissed. */
  readonly close = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
