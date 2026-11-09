import { Component, OnInit, PendingTasks, inject, input, output, signal } from '@angular/core';
import { GameFolder, GameLibrary as Library } from '../../services/game-library';
import { CustomButton } from '../button/button';

@Component({
  selector: 'app-game-library',
  templateUrl: './game-library.html',
  imports: [CustomButton],
  styleUrl: './game-library.scss',
})
export class GameLibrary implements OnInit {
  private readonly library = inject(Library);
  private readonly tasks = inject(PendingTasks);
  readonly pgn = input('');
  readonly openGame = output<string>();
  readonly practise = output<GameFolder>();
  readonly close = output<void>();
  readonly folders = signal<GameFolder[]>([]);
  readonly selectedFolder = signal('');
  readonly pending = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly deleteTarget = signal<{ folderId: string; gameId: string } | null>(null);

  ngOnInit(): void {
    this.tasks.run(() => this.run(() => this.reload()));
  }

  private async reload(): Promise<void> {
    this.folders.set(await this.library.list());
  }

  async createFolder(name: string): Promise<void> {
    await this.run(async () => {
      await this.library.createFolder(name);
      await this.reload();
      this.message.set('Folder created.');
    });
  }

  async save(name: string): Promise<void> {
    await this.run(async () => {
      await this.library.save(this.selectedFolder(), name, this.pgn());
      this.message.set('Game saved.');
      await this.reload();
    });
  }

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
      this.message.set('Game deleted.');
    });
  }

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
          : 'The game library could not be accessed. Please try again.',
      );
    } finally {
      this.pending.set(false);
      complete();
    }
  }
}
