import { Component, input, output } from '@angular/core';
import { Color } from 'chess.js';
import { TrainingSession } from '../../sessions/training-session';
import { CustomButton } from '../../../button/button';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

/** Status and action panel for a folder training round: progress, feedback, hint/show buttons and round navigation. */
@Component({
  selector: 'app-training-panel',
  styleUrl: '../controls.scss',
  imports: [CustomButton, TranslatePipe],
  templateUrl: './training-panel.html',
})
export class TrainingPanel {
  /** Active training session, or `null` while it is still being prepared. */
  readonly session = input.required<TrainingSession | null>();
  /** Error message to display; an empty string means no error. */
  readonly error = input.required<string>();
  /** Emits the side to train as when the user restarts a completed round. */
  readonly start = output<Color>();
  /** Emits when the user asks for the next game after completing one. */
  readonly next = output<void>();
  /** Emits when the user wants to play the move revealed by "Show". */
  readonly playSolution = output<void>();
}
