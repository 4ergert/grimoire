import { Component, input, output } from '@angular/core';
import { Color } from 'chess.js';
import { TrainingSession } from '../../sessions/training-session';
import { CustomButton } from '../../../button/button';

@Component({
  selector: 'app-training-panel',
  styleUrl: '../controls.scss',
  imports: [CustomButton],
  templateUrl: './training-panel.html',
})
export class TrainingPanel {
  readonly session = input.required<TrainingSession | null>();
  readonly error = input.required<string>();
  readonly start = output<Color>();
  readonly next = output<void>();
  readonly playSolution = output<void>();
}
