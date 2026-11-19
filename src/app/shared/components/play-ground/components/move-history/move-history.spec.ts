import { ComponentFixture, TestBed } from '@angular/core/testing';
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
