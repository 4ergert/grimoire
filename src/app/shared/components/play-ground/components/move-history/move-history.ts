import { Component, input } from '@angular/core';
import { GameTurn } from '../../sessions/game-session';

@Component({
  selector: 'app-move-history',
  styleUrl: './move-history.scss',
  template: `
    <section class="move-history" aria-label="Move history">
      <h2>Moves</h2>
      @if (replaying()) {
        <ol>
          @for (move of replayMoves(); track $index) {
            <li>{{ move }}</li>
          }
        </ol>
      } @else if (history().length) {
        <table>
          <thead>
            <tr>
              <th scope="col">Move</th>
              <th scope="col">White</th>
              <th scope="col">Black</th>
            </tr>
          </thead>
          <tbody>
            @for (turn of history(); track turn.number) {
              <tr>
                <th scope="row">{{ turn.number }}.</th>
                <td>{{ turn.white }}</td>
                <td>{{ turn.black }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p>No moves yet.</p>
      }
    </section>
  `,
})
export class MoveHistory {
  readonly replaying = input.required<boolean>();
  readonly replayMoves = input.required<string[]>();
  readonly history = input.required<GameTurn[]>();
}
