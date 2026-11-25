import { Component, OnInit, PendingTasks, inject, input, output, signal } from '@angular/core';
import { GameFolder, GameLibrary as Library } from '../../services/game-library';
import { CustomButton } from '../button/button';
import { TranslatePipe } from '../../i18n/translate-pipe';
import { tr } from '../../i18n/i18n';

@Component({
  selector: 'app-game-library',
  templateUrl: './game-library.html',
  imports: [CustomButton, TranslatePipe],
  styleUrl: './game-library.scss',
})
/**
 * Repertoire view: lists the user's folders and games, and lets them create or delete
 * folders, save the current PGN, and delete games. Operations run one at a time and
 * report their outcome through {@link GameLibrary.message} or {@link GameLibrary.error}.
 */
export class GameLibrary implements OnInit {
  private readonly library = inject(Library);
  private readonly tasks = inject(PendingTasks);
  /** PGN of the current game; this is what {@link GameLibrary.save} stores. */
  readonly pgn = input('');
  /** Emits the PGN of a saved game the user opens. */
  readonly openGame = output<string>();
  /** Emits the folder the user wants to practise. */
  readonly practise = output<GameFolder>();
  /** Emits when the user asks to create a new game. */
  readonly create = output<void>();
  readonly close = output<void>();
  /** Folders (with their games) as last loaded or locally updated. */
  readonly folders = signal<GameFolder[]>([]);
  /** Id of the folder chosen as the target for saving; empty if none. */
  readonly selectedFolder = signal('');
  /** True while an operation runs; operations started meanwhile are ignored. */
  readonly pending = signal(false);
  /** Message of the last failed operation; empty for none. */
  readonly error = signal('');
  /** Confirmation of the last successful operation; empty for none. */
  readonly message = signal('');
  /** Game awaiting delete confirmation, or null when none is pending. */
  readonly deleteTarget = signal<{ folderId: string; gameId: string } | null>(null);
  /** Id of the folder awaiting delete confirmation, or null when none is pending. */
  readonly deleteFolderTarget = signal<string | null>(null);

  /** Loads the folders, registering the load as a pending task (e.g. so rendering waits for it). */
  ngOnInit(): void {
    this.tasks.run(() => this.run(() => this.reload()));
  }

  private async reload(): Promise<void> {
    this.folders.set(await this.library.list());
  }

  /**
   * Creates a folder and reloads the list.
   * @param name - Folder name.
   * @param color - `'b'` for black; any other value is treated as white.
   */
  async createFolder(name: string, color: string): Promise<void> {
    await this.run(async () => {
      await this.library.createFolder(name, color === 'b' ? 'b' : 'w');
      await this.reload();
      this.message.set(tr('Folder created.'));
    });
  }

  /**
   * Saves the current {@link GameLibrary.pgn} under the given name in the selected folder,
   * then reloads the list.
   * @param name - Name for the saved game.
   */
  async save(name: string): Promise<void> {
    await this.run(async () => {
      await this.library.save(this.selectedFolder(), name, this.pgn());
      this.message.set(tr('Game saved.'));
      await this.reload();
    });
  }

  /** Deletes the folder in {@link GameLibrary.deleteFolderTarget} and clears any selection that referenced it. */
  async deleteFolder(): Promise<void> {
    const folderId = this.deleteFolderTarget();
    if (!folderId) return;
    await this.run(async () => {
      await this.library.deleteFolder(folderId);
      this.folders.update((folders) => folders.filter((folder) => folder.id !== folderId));
      this.deleteFolderTarget.set(null);
      if (this.deleteTarget()?.folderId === folderId) this.deleteTarget.set(null);
      if (this.selectedFolder() === folderId) this.selectedFolder.set('');
      this.message.set(tr('Folder deleted.'));
    });
  }

  /** Deletes the game in {@link GameLibrary.deleteTarget} and removes it from the local list. */
  async deleteGame(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    await this.run(async () => {
      await this.library.deleteGame(target.folderId, target.gameId);
      this.folders.update((folders) =>
        folders.map((folder) =>
          folder.id === target.folderId
            ? { ...folder, games: folder.games.filter((game) => game.id !== target.gameId) }
            : folder,
        ),
      );
      this.deleteTarget.set(null);
      this.message.set(tr('Game deleted.'));
    });
  }

  /**
   * Runs an operation with the shared pending/error/message handling: skipped if one is
   * already running, clears old feedback first, and turns a thrown error into {@link GameLibrary.error}.
   */
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.pending()) return;
    const complete = this.tasks.add();
    this.pending.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await action();
    } catch (error) {
      console.error('Game library operation failed', error);
      this.error.set(
        error instanceof Error
          ? error.message
          : tr('The game library could not be accessed. Please try again.'),
      );
    } finally {
      this.pending.set(false);
      complete();
    }
  }
}
