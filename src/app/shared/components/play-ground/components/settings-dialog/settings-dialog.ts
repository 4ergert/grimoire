import { Component, ElementRef, afterNextRender, inject, output, viewChild } from '@angular/core';
import { BoardThemeService, SquareColor } from '../../../../services/board-theme';
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
  // Order of the 2x2 preview, matching the checkerboard pattern in the stylesheet.
  readonly previewSquares: readonly SquareColor[] = ['light', 'dark', 'dark', 'light'];
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  pick(square: SquareColor, event: Event): void {
    this.themes.setCustomColor(square, (event.target as HTMLInputElement).value);
  }
}
