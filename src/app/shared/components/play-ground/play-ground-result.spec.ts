import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PlayGround } from './play-ground';

describe('PlayGround game over dialog', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
  });

  afterEach(() => Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'));

  async function setup(color: 'w' | 'b' = 'w') {
    await TestBed.configureTestingModule({ imports: [PlayGround] }).compileComponents();
    const fixture = TestBed.createComponent(PlayGround);
    fixture.componentRef.setInput('computerGame', true);
    fixture.detectChanges();
    fixture.componentInstance.startEngineGame(color, 3);
    await fixture.whenStable();
    return fixture;
  }

  function foolsMate(fixture: Awaited<ReturnType<typeof setup>>): void {
    const game = fixture.componentInstance.game;
    game.move('f2', 'f3');
    game.move('e7', 'e5');
    game.move('g2', 'g4');
    game.move('d8', 'h4');
  }

  function dialogText(fixture: Awaited<ReturnType<typeof setup>>): string {
    return fixture.nativeElement.querySelector('app-game-over-dialog')?.textContent ?? '';
  }

  it('announces a loss against Stockfish and offers the follow-up actions', async () => {
    const fixture = await setup('w');
    expect(fixture.nativeElement.querySelector('app-game-over-dialog')).toBeNull();

    foolsMate(fixture);
    await fixture.whenStable();

    const text = dialogText(fixture);
    expect(text).toContain('Stockfish wins');
    expect(text).toContain('Checkmate · Level 3');
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('app-game-over-dialog button'),
        (button: HTMLElement) => button.textContent?.trim(),
      ),
    ).toEqual(['New game…', 'Analyse game', 'Save to repertoire', 'Back to menu']);
  });

  it('announces a win for the player', async () => {
    const fixture = await setup('b');
    foolsMate(fixture);
    await fixture.whenStable();

    expect(dialogText(fixture)).toContain('You win!');
  });

  it('hides the save button for guests', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('guest', true);
    foolsMate(fixture);
    await fixture.whenStable();

    expect(dialogText(fixture)).not.toContain('Save to repertoire');
  });

  it('opens the side dialog again for a new game', async () => {
    const fixture = await setup();
    foolsMate(fixture);
    await fixture.whenStable();

    fixture.nativeElement.querySelector('app-game-over-dialog button').click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-game-over-dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-engine-side-dialog')).not.toBeNull();
    expect(fixture.componentInstance.moveHistory()).toEqual([]);
  });

  it('switches to a navigable analysis board when analysing the game', async () => {
    const fixture = await setup();
    foolsMate(fixture);
    await fixture.whenStable();

    fixture.nativeElement.querySelectorAll('app-game-over-dialog button')[1].click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-game-over-dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-replay-controls')).not.toBeNull();
    expect(fixture.componentInstance.engineMode()).toBe('analysis');
  });

  it('forwards saving and leaving to the parent', async () => {
    const fixture = await setup();
    const saved = vi.fn();
    const left = vi.fn();
    fixture.componentInstance.saveGame.subscribe(saved);
    fixture.componentInstance.back.subscribe(left);
    foolsMate(fixture);
    await fixture.whenStable();

    fixture.nativeElement.querySelectorAll('app-game-over-dialog button')[2].click();
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledOnce();
    expect(saved.mock.calls[0][0]).toContain('Qh4#');
    expect(fixture.nativeElement.querySelector('app-game-over-dialog')).toBeNull();

    fixture.componentInstance.restart();
    foolsMate(fixture);
    await fixture.whenStable();
    fixture.nativeElement.querySelectorAll('app-game-over-dialog button')[3].click();
    expect(left).toHaveBeenCalledOnce();
  });
});
