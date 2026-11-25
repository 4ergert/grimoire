import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MoveHistory } from './move-history';

describe('MoveHistory comments', () => {
  let fixture: ComponentFixture<MoveHistory>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MoveHistory] }).compileComponents();
    fixture = TestBed.createComponent(MoveHistory);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('replaying', false);
    fixture.componentRef.setInput('replayMoves', []);
    fixture.componentRef.setInput('canSave', true);
    fixture.componentRef.setInput('history', [{ number: 1, white: 'e4', black: 'e5' }]);
    fixture.componentRef.setInput('historyPlys', [{ white: 1, black: 2 }]);
    fixture.componentRef.setInput('allowComments', true);
  });

  it('emits the comment for a full move after editing it', () => {
    const emitted: { turn: number; text: string }[] = [];
    fixture.componentInstance.commentChange.subscribe((event) => emitted.push(event));
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.comment-button')!.click();
    fixture.detectChanges();
    const input = element.querySelector<HTMLInputElement>('.comment-input')!;
    input.value = 'Open game';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(emitted).toEqual([{ turn: 1, text: 'Open game' }]);
    expect(element.querySelector('.comment-input')).toBeNull();
  });

  it('shows existing comments below their move', () => {
    fixture.componentRef.setInput('comments', { 1: 'Open game' });
    fixture.detectChanges();

    expect(element.querySelector('.comment-text')?.textContent?.trim()).toBe('Open game');
  });

  it('hides the comment button when comments are not allowed', () => {
    fixture.componentRef.setInput('allowComments', false);
    fixture.detectChanges();

    expect(element.querySelector('.comment-button')).toBeNull();
  });
});

describe('MoveHistory PGN copy', () => {
  let fixture: ComponentFixture<MoveHistory>;
  let element: HTMLElement;
  const writeText = vi.fn();

  const button = () =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('.move-history-footer button')).find(
      (candidate) => candidate.textContent?.includes('PGN') || candidate.textContent?.includes('Copy'),
    );

  beforeEach(async () => {
    vi.useFakeTimers();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await TestBed.configureTestingModule({ imports: [MoveHistory] }).compileComponents();
    fixture = TestBed.createComponent(MoveHistory);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('replaying', false);
    fixture.componentRef.setInput('replayMoves', []);
    fixture.componentRef.setInput('canSave', true);
    fixture.componentRef.setInput('history', [{ number: 1, white: 'e4', black: '' }]);
    fixture.componentRef.setInput('historyPlys', [{ white: 1, black: null }]);
    fixture.componentRef.setInput('pgn', '1. e4 *');
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies the PGN and confirms it briefly once a move is recorded', async () => {
    fixture.detectChanges();
    expect(button()?.textContent?.trim()).toBe('Copy PGN');

    button()!.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith('1. e4 *');
    expect(button()?.textContent?.trim()).toBe('PGN copied');

    await vi.advanceTimersByTimeAsync(2000);
    fixture.detectChanges();
    expect(button()?.textContent?.trim()).toBe('Copy PGN');
  });

  it('reports a failed copy when the clipboard is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    writeText.mockRejectedValue(new Error('denied'));
    document.execCommand = vi.fn(() => false);
    fixture.detectChanges();

    button()!.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(button()?.textContent?.trim()).toBe('Copy failed');
  });

  it('is hidden while no move is recorded', () => {
    fixture.componentRef.setInput('history', []);
    fixture.componentRef.setInput('historyPlys', []);
    fixture.componentRef.setInput('pgn', '');
    fixture.detectChanges();

    expect(element.querySelector('.move-history-footer')).toBeNull();
  });

  it('is offered while replaying a saved game', () => {
    fixture.componentRef.setInput('replaying', true);
    fixture.componentRef.setInput('replayMoves', ['e4', 'e5']);
    fixture.componentRef.setInput('pgn', '1. e4 e5 *');
    fixture.detectChanges();

    expect(button()).toBeDefined();
  });
});
