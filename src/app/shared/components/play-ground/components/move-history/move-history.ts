import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { GameTurn } from '../../sessions/game-session';
import { tr } from '../../../../i18n/i18n';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

@Component({
  selector: 'app-move-history',
  styleUrl: './move-history.scss',
  imports: [TranslatePipe],
  template: `
    <section class="move-history" [attr.aria-label]="'Move history' | t">
      <header class="move-history-header">
        <h2>{{ 'History' | t }}</h2>
        @if (!replaying() && showSave()) {
          <button class="save_button" type="button" [disabled]="!canSave()" (click)="save.emit()">
            {{ 'Save to repertoire' | t }}
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
              <th scope="col">{{ 'Move' | t }}</th>
              <th scope="col">{{ 'White' | t }}</th>
              <th scope="col">{{ 'Black' | t }}</th>
              @if (allowComments()) {
                <th scope="col" class="comment-col"><span class="visually-hidden">{{ 'Comment' | t }}</span></th>
              }
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
                  @if (allowComments()) {
                    <td class="comment-col">
                      <button
                        class="comment-button"
                        type="button"
                        [attr.aria-label]="
                          comments()[turn.number]
                            ? ('Edit comment for move {number}' | t: { number: turn.number })
                            : ('Add comment to move {number}' | t: { number: turn.number })
                        "
                        [attr.aria-pressed]="editingTurn() === turn.number"
                        [class.has-comment]="!!comments()[turn.number]"
                        (click)="toggleEditing(turn.number)"
                      >
                        <span aria-hidden="true">&#x1F4AC;</span>
                      </button>
                    </td>
                  }
              </tr>
              @if (editingTurn() === turn.number) {
                <tr class="comment-row">
                  <td [attr.colspan]="allowComments() ? 4 : 3">
                    <input
                      #commentInput
                      class="comment-input"
                      type="text"
                      maxlength="500"
                      [attr.aria-label]="'Comment for move {number}' | t: { number: turn.number }"
                      [value]="comments()[turn.number] || ''"
                      (keydown.enter)="commitComment(turn.number, commentInput.value)"
                      (keydown.escape)="editingTurn.set(null)"
                      (blur)="commitComment(turn.number, commentInput.value)"
                    />
                  </td>
                </tr>
              } @else if (comments()[turn.number]) {
                <tr class="comment-row">
                  <td class="comment-text" [attr.colspan]="allowComments() ? 4 : 3">
                    {{ comments()[turn.number] }}
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      } @else {
        @if (showImport()) {
          @if (importOpen()) {
            <form (submit)="$event.preventDefault(); importPgn.emit(pgnInput.value)">
              <label for="pgn-input">{{ 'PGN' | t }}</label>
              <textarea #pgnInput id="pgn-input" rows="5" required></textarea>
              <div class="load_game">
                <button class="save_button" type="submit">{{ 'load game' | t }}</button>
                <button class="save_button" type="button" (click)="importOpen.set(false)">{{ 'cancel' | t }}</button>
              </div>
            </form>
            @if (importError()) {
              <p role="alert">{{ importError() | t }}</p>
            }
          } @else {
            <button class="save_button" type="button" (click)="importOpen.set(true)">
              {{ 'Insert PGN' | t }}
            </button>
          }
        } @else {
          <p>{{ 'No moves yet.' | t }}</p>
        }
      }
      @if (pgn() && (replaying() ? replayMoves().length : history().length)) {
        <footer class="move-history-footer">
          <button class="save_button" type="button" (click)="copyPgn()">
            {{ copyLabel() | t }}
          </button>
        </footer>
      }
    </section>
  `,
})
export class MoveHistory {
  private readonly destroyRef = inject(DestroyRef);
  private copyTimer: ReturnType<typeof setTimeout> | undefined;
  readonly importOpen = signal(false);
  readonly editingTurn = signal<number | null>(null);
  readonly copyStatus = signal<'idle' | 'copied' | 'failed'>('idle');
  readonly copyLabel = computed(() => {
    const status = this.copyStatus();
    return status === 'copied'
      ? tr('PGN copied')
      : status === 'failed'
        ? tr('Copy failed')
        : tr('Copy PGN');
  });
  private readonly commentInput = viewChild<ElementRef<HTMLInputElement>>('commentInput');
  readonly replaying = input.required<boolean>();
  readonly replayMoves = input.required<string[]>();
  readonly history = input.required<GameTurn[]>();
  readonly historyPlys = input.required<{ white: number | null; black: number | null }[]>();
  readonly pgn = input('');
  readonly comments = input<Record<number, string>>({});
  readonly allowComments = input(false);
  readonly canSave = input.required<boolean>();
  readonly showNavigation = input(false);
  readonly currentPly = input(0);
  readonly showImport = input(false);
  readonly importError = input('');
  readonly showSave = input(true);
  readonly save = output<void>();
  readonly importPgn = output<string>();
  readonly navigate = output<number>();
  readonly commentChange = output<{ turn: number; text: string }>();

  constructor() {
    effect(() => this.commentInput()?.nativeElement.focus());
    this.destroyRef.onDestroy(() => clearTimeout(this.copyTimer));
  }

  async copyPgn(): Promise<void> {
    this.copyStatus.set((await this.writeToClipboard(this.pgn())) ? 'copied' : 'failed');
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copyStatus.set('idle'), 2000);
  }

  private async writeToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('PGN could not be copied with the Clipboard API', error);
    }
    // Fallback for insecure contexts or denied permission.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }

  toggleEditing(turn: number): void {
    this.editingTurn.update((current) => (current === turn ? null : turn));
  }

  commitComment(turn: number, text: string): void {
    if (this.editingTurn() !== turn) return;
    this.editingTurn.set(null);
    this.commentChange.emit({ turn, text });
  }
}
