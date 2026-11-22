import { Component, ElementRef, afterNextRender, inject, output, viewChild } from '@angular/core';
import { BoardThemeService } from '../../../../services/board-theme';
import { CustomButton } from '../../../button/button';

@Component({
  selector: 'app-settings-dialog',
  imports: [CustomButton],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
})
export class SettingsDialog {
  readonly themes = inject(BoardThemeService);
  readonly close = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
