import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Chess } from 'chess.js';
import { vi } from 'vitest';
import { BoardMotion } from './board-motion';

@Component({
  imports: [BoardMotion],
  template: `<div [appBoardMotion]="fen()">
    @for (square of squares; track square) {
      <button [attr.data-square]="square"><span class="piece"></span></button>
    }
  </div>`,
})
class TestBoard {
  readonly fen = signal(new Chess().fen());
  readonly squares = ['e4', 'e5', 'f1', 'g1', 'e2'];
}

describe('BoardMotion', () => {
  it('should slide a moved piece from its source and cancel on destruction', async () => {
    const fixture = TestBed.createComponent(TestBoard);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement.firstElementChild;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      ...host.getBoundingClientRect(),
      width: 400,
    });
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    const target = host.querySelector<HTMLElement>('[data-square="e4"] .piece')!;
    Object.defineProperty(target, 'animate', { value: animate });
    const game = new Chess();
    game.move('e4');
    fixture.componentInstance.fen.set(game.fen());
    await fixture.whenStable();
    expect(animate).toHaveBeenCalledWith(
      [
        { transform: 'translate(0px, 100px)', zIndex: '2' },
        { transform: 'translate(0, 0)', zIndex: '2' },
      ],
      expect.objectContaining({ duration: 260 }),
    );
    fixture.destroy();
    expect(cancel).toHaveBeenCalled();
  });

  it('should animate both pieces during castling and respect reduced motion', async () => {
    const fixture = TestBed.createComponent(TestBoard);
    const game = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    fixture.componentInstance.fen.set(game.fen());
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement.firstElementChild;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      ...host.getBoundingClientRect(),
      width: 400,
    });
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    for (const piece of host.querySelectorAll('.piece')) {
      Object.defineProperty(piece, 'animate', { value: animate });
    }
    game.move('O-O');
    fixture.componentInstance.fen.set(game.fen());
    await fixture.whenStable();
    expect(animate).toHaveBeenCalledTimes(2);
    animate.mockClear();
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      game.undo();
      fixture.componentInstance.fen.set(game.fen());
      await fixture.whenStable();
      expect(animate).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
