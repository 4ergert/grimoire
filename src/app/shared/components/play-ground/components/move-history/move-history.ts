import { Component, input, output, signal } from '@angular/core';
import { GameTurn } from '../../sessions/game-session';

@Component({
  selector: 'app-move-history',
  styleUrl: './move-history.scss',
  template: `
    <section class="move-history" aria-label="Move history">
      <header class="move-history-header">
        <h2>History</h2>
        @if (!replaying() && showSave()) {
          <button class="save_button" type="button" [disabled]="!canSave()" (click)="save.emit()">
            Save to repertoire
          </button>
        }
      </header>
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
                  <td>
                    @if (showNavigation() && turn.white) {
                      <button
                        class="move-link"
                        type="button"
                        [attr.aria-pressed]="currentPly() === historyPlys()[$index].white"
                        (click)="navigate.emit(historyPlys()[$index].white!)"
                      >
                        {{ turn.white }}
                      </button>
                    } @else {
                      {{ turn.white }}
                    }
                  </td>
                  <td>
                    @if (showNavigation() && turn.black) {
                      <button
                        class="move-link"
                        type="button"
                        [attr.aria-pressed]="currentPly() === historyPlys()[$index].black"
                        (click)="navigate.emit(historyPlys()[$index].black!)"
                      >
                        {{ turn.black }}
                      </button>
                    } @else {
                      {{ turn.black }}
                    }
                  </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        @if (showImport()) {
          @if (importOpen()) {
            <form (submit)="$event.preventDefault(); importPgn.emit(pgnInput.value)">
              <label for="pgn-input">PGN</label>
              <textarea #pgnInput id="pgn-input" rows="5" required></textarea>
              <button class="save_button" type="submit">Spiel laden</button>
              <button class="save_button" type="button" (click)="importOpen.set(false)">
                Abbrechen
              </button>
            </form>
            @if (importError()) {
              <p role="alert">{{ importError() }}</p>
            }
          } @else {
            <button class="save_button" type="button" (click)="importOpen.set(true)">
              PGN einfügen
            </button>
          }
        } @else {
          <p>No moves yet.</p>
        }
      }
    </section>
  `,
})
export class MoveHistory {
  readonly importOpen = signal(false);
  readonly replaying = input.required<boolean>();
  readonly replayMoves = input.required<string[]>();
  readonly history = input.required<GameTurn[]>();
  readonly historyPlys = input.required<{ white: number | null; black: number | null }[]>();
  readonly canSave = input.required<boolean>();
  readonly showNavigation = input(false);
  readonly currentPly = input(0);
  readonly showImport = input(false);
  readonly importError = input('');
  readonly showSave = input(true);
  readonly save = output<void>();
  readonly importPgn = output<string>();
  readonly navigate = output<number>();
}
