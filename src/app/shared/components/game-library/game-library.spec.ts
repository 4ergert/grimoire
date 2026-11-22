import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GameLibrary } from './game-library';
import { GameLibrary as Library } from '../../services/game-library';

describe('GameLibrary component', () => {
  const library = {
    list: vi.fn(),
    createFolder: vi.fn(),
    save: vi.fn(),
    deleteGame: vi.fn(),
    deleteFolder: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    library.list.mockResolvedValue([
      {
        id: 'folder-1',
        name: 'Training',
        games: [{ id: 'game-1', name: 'Opening', pgn: '1. e4 *' }],
      },
    ]);
    TestBed.configureTestingModule({
      imports: [GameLibrary],
      providers: [{ provide: Library, useValue: library }],
    });
  });

  it('should list folders, open saved PGN and save into the selected folder', async () => {
    const fixture = TestBed.createComponent(GameLibrary);
    fixture.componentRef.setInput('pgn', '1. d4 *');
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const open = vi.fn();
    component.openGame.subscribe(open);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('summary')?.textContent).toContain('Training');
    element.querySelector<HTMLButtonElement>('li button')!.click();
    expect(open).toHaveBeenCalledWith('1. e4 *');
    component.selectedFolder.set('folder-1');
    await component.save('My game');
    expect(library.save).toHaveBeenCalledWith('folder-1', 'My game', '1. d4 *');
    expect(component.message()).toBe('Game saved.');
    await component.createFolder('Endgames');
    expect(library.createFolder).toHaveBeenCalledWith('Endgames');
  });

  it('should show failed reads and writes explicitly', async () => {
    library.list.mockRejectedValue(new Error('Permission denied'));
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Permission denied',
    );
    library.createFolder.mockRejectedValue(new Error('Offline'));
    await fixture.componentInstance.createFolder('Training');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Offline');
    expect(fixture.componentInstance.pending()).toBe(false);
  });

  it('should emit the selected folder for training without modifying saved games', async () => {
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    const practise = vi.fn();
    fixture.componentInstance.practise.subscribe(practise);
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLElement>('summary .summary-row p')!.click();
    expect(practise).toHaveBeenCalledWith(fixture.componentInstance.folders()[0]);
    expect(library.save).not.toHaveBeenCalled();
  });

  it('should offer a Create button in each folder that asks to start creating', async () => {
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    const create = vi.fn();
    fixture.componentInstance.create.subscribe(create);

    const button = fixture.nativeElement.querySelector('details .folder_actions .create_game_button');
    expect(button.textContent.trim()).toBe('Create');
    button.click();

    expect(create).toHaveBeenCalledOnce();
    expect(library.save).not.toHaveBeenCalled();
  });

  it('should require confirmation and remove a folder only after successful deletion', async () => {
    library.list.mockResolvedValue([
      { id: 'folder-1', name: 'Training', games: [{ id: 'game-1', name: 'Opening', pgn: '1. e4 *' }] },
      { id: 'folder-2', name: 'Endgames', games: [] },
    ]);
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const first = () => element.querySelector('details')!;
    const buttonLabels = () =>
      Array.from(first().querySelectorAll('.folder_actions button'), (b) => b.textContent?.trim());

    expect(buttonLabels()).toEqual(['Create', 'Delete folder']);
    first().querySelector<HTMLButtonElement>('.delete_folder_button')!.click();
    await fixture.whenStable();
    expect(library.deleteFolder).not.toHaveBeenCalled();
    expect(first().querySelector('.folder_actions')?.textContent).toContain(
      'Delete folder "Training" with 1 game permanently?',
    );

    first().querySelectorAll<HTMLButtonElement>('.folder_actions button')[2].click();
    await fixture.whenStable();
    expect(buttonLabels()).toEqual(['Create', 'Delete folder']);
    expect(library.deleteFolder).not.toHaveBeenCalled();

    first().querySelector<HTMLButtonElement>('.delete_folder_button')!.click();
    await fixture.whenStable();
    fixture.componentInstance.selectedFolder.set('folder-1');
    first().querySelector<HTMLButtonElement>('.confirm-delete-folder')!.click();
    await fixture.whenStable();

    expect(library.deleteFolder).toHaveBeenCalledWith('folder-1');
    expect(fixture.componentInstance.folders().map((folder) => folder.id)).toEqual(['folder-2']);
    expect(fixture.componentInstance.selectedFolder()).toBe('');
    expect(element.querySelectorAll('details')).toHaveLength(1);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Folder deleted.');
  });

  it('should keep the folder and show the error when its deletion fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    library.deleteFolder.mockRejectedValue(new Error('Permission denied'));
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    fixture.componentInstance.deleteFolderTarget.set('folder-1');
    await fixture.componentInstance.deleteFolder();
    await fixture.whenStable();

    expect(fixture.componentInstance.folders()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Permission denied',
    );
    expect(fixture.componentInstance.pending()).toBe(false);
  });

  it('should require confirmation and remove a game only after successful deletion', async () => {
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('.delete-game')!.click();
    await fixture.whenStable();
    expect(library.deleteGame).not.toHaveBeenCalled();
    const confirmation = element.querySelector('.delete-confirmation')!;
    confirmation.querySelectorAll<HTMLButtonElement>('button')[1].click();
    await fixture.whenStable();
    expect(element.querySelector('.delete-confirmation')).toBeNull();
    expect(library.deleteGame).not.toHaveBeenCalled();

    element.querySelector<HTMLButtonElement>('.delete-game')!.click();
    await fixture.whenStable();
    let finish!: () => void;
    library.deleteGame.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    element.querySelector<HTMLButtonElement>('.delete-confirmation button')!.click();
    fixture.detectChanges();
    expect(library.deleteGame).toHaveBeenCalledWith('folder-1', 'game-1');
    expect(element.querySelector('.saved-game')).not.toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.delete-game')!.disabled).toBe(true);
    finish();
    await fixture.whenStable();
    expect(element.querySelector('.saved-game')).toBeNull();
    expect(element.querySelector('summary .summary-row > div')?.textContent?.trim()).toBe(
      'Training - 0 games',
    );
    expect(fixture.componentInstance.folders()).toHaveLength(1);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Game deleted.');
  });

  it('should retain the game and show deletion errors', async () => {
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    library.deleteGame.mockRejectedValue(new Error('Permission denied'));
    fixture.componentInstance.deleteTarget.set({ folderId: 'folder-1', gameId: 'game-1' });
    await fixture.componentInstance.deleteGame();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.saved-game')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Permission denied',
    );
    expect(fixture.componentInstance.pending()).toBe(false);
  });

  it('should keep deletion confirmation scoped to the selected folder and game', async () => {
    library.list.mockResolvedValue([
      {
        id: 'folder-1',
        name: 'First',
        games: [
          { id: 'shared-id', name: 'First line', pgn: '1. e4 *' },
          { id: 'other-id', name: 'Other line', pgn: '1. d4 *' },
        ],
      },
      {
        id: 'folder-2',
        name: 'Second',
        games: [{ id: 'shared-id', name: 'Second line', pgn: '1. c4 *' }],
      },
    ]);
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const deleteButtons = element.querySelectorAll<HTMLButtonElement>('.delete-game');

    for (const [index, name] of ['First line', 'Other line', 'Second line'].entries()) {
      deleteButtons[index].click();
      await fixture.whenStable();
      const confirmations = element.querySelectorAll('.delete-confirmation');
      expect(confirmations).toHaveLength(1);
      expect(confirmations[0].getAttribute('aria-label')).toBe(`Confirm deletion of ${name}`);
    }

    fixture.componentInstance.deleteTarget.set(null);
    await fixture.whenStable();
    expect(element.querySelector('.delete-confirmation')).toBeNull();
    expect(library.deleteGame).not.toHaveBeenCalled();
  });

  it('should render custom button content without nesting buttons and toggle the save form', async () => {
    const fixture = TestBed.createComponent(GameLibrary);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('button[custom-button]')!;
    expect(button.querySelector('.custom_button')?.textContent?.trim()).toBe('Back');
    expect(button.querySelector('button')).toBeNull();
    expect(element.querySelector('#game-name')).toBeNull();

    fixture.componentRef.setInput('pgn', '1. e4 *');
    await fixture.whenStable();
    expect(element.querySelector('#game-name')).not.toBeNull();
    expect(element.querySelectorAll('#save-folder option')).toHaveLength(2);

    fixture.componentRef.setInput('pgn', '');
    await fixture.whenStable();
    expect(element.querySelector('#game-name')).toBeNull();
    expect(element.querySelector('#folder-name')).not.toBeNull();
  });
});
