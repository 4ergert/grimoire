import { Component, input, output } from '@angular/core';
import { Color } from 'chess.js';
import { TrainingSession } from '../../sessions/training-session';

@Component({
  selector: 'app-training-panel',
  styleUrl: '../controls.scss',
  template: `
    <section class="training-panel" aria-label="Folder training">
      @if (session(); as session) {
        <p>
          Playing {{ session.color() === 'w' ? 'White' : 'Black' }}. Game
          {{ session.gameIndex() + 1 }} / {{ session.gameCount() }}. Moves {{ session.ply() }} /
          {{ session.moveCount() }}.
        </p>
        <p>
          Round totals: {{ session.mistakes() }} mistakes, {{ session.hints() }} hints,
          {{ session.shownMoves() }} shown moves.
        </p>
        <p role="status" aria-live="polite">{{ session.feedback() }}</p>
        @if (session.complete()) {
          <h2>{{ session.roundComplete() ? 'Round complete!' : 'Game complete!' }}</h2>
          @if (session.roundComplete()) {
            <button type="button" class="restart" (click)="start.emit(session.color())">
              Restart round
            </button>
          } @else {
            <button type="button" class="restart" (click)="next.emit()">Next game</button>
          }
        } @else {
          <button type="button" class="restart" (click)="session.hint()">Hint</button>
          <button type="button" class="restart" (click)="session.reveal()">Show move</button>
          @if (session.revealedMove()) {
            <p>Saved move: {{ session.revealedMove() }}</p>
            <button type="button" class="restart" (click)="playSolution.emit()">
              Play shown move
            </button>
          }
        }
      } @else {
        <p>
          Choose your side. Practise each saved game once in random order. Only the exact saved move
          is accepted, not every good chess move.
        </p>
        <button type="button" class="restart" (click)="start.emit('w')">Train White</button>
        <button type="button" class="restart" (click)="start.emit('b')">Train Black</button>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
    </section>
  `,
})
export class TrainingPanel {
  readonly session = input.required<TrainingSession | null>();
  readonly error = input.required<string>();
  readonly start = output<Color>();
  readonly next = output<void>();
  readonly playSolution = output<void>();
}
