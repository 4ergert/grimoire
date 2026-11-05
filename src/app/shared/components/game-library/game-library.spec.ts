import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GameLibrary } from './game-library';
import { GameLibrary as Library } from '../../services/game-library';

describe('GameLibrary component', () => {
  const library = { list: vi.fn(), createFolder: vi.fn(), save: vi.fn(), deleteGame: vi.fn() };

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
    const button = Array.from(element.querySelectorAll<HTMLButtonElement>('details button')).find(
      (button) => button.textContent?.trim() === 'Practise folder',
    )!;
    button.click();
    expect(practise).toHaveBeenCalledWith(fixture.componentInstance.folders()[0]);
    expect(library.save).not.toHaveBeenCalled();
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
    expect(element.querySelector('summary')?.textContent).toContain('(0)');
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
});
