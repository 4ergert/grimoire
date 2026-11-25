import { Component, ElementRef, afterNextRender, inject, output, viewChild } from '@angular/core';
import { BoardThemeService, SquareColor } from '../../../../services/board-theme';
import { CustomButton } from '../../../button/button';
import { tr } from '../../../../i18n/i18n';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

@Component({
  selector: 'app-settings-dialog',
  imports: [CustomButton, TranslatePipe],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
})
export class SettingsDialog {
  readonly themes = inject(BoardThemeService);
  readonly close = output<void>();
  readonly squareLabels: Record<SquareColor, { label: string; title: string }> = {
    light: {
      label: tr('Color of the light squares'),
      title: tr('Choose the color of the light squares'),
    },
    dark: {
      label: tr('Color of the dark squares'),
      title: tr('Choose the color of the dark squares'),
    },
  };
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
