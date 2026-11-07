import {
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
} from '@angular/core';
import { Chess, Piece, Square, SQUARES } from 'chess.js';

@Directive({ selector: '[appBoardMotion]' })
export class BoardMotion implements OnChanges, OnDestroy {
  @Input({ required: true }) appBoardMotion = '';
  @Input() boardFlipped = false;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private previous = '';
  private animations: Animation[] = [];
  private render?: ReturnType<typeof afterNextRender>;

  ngOnChanges(): void {
    const before = this.previous;
    this.previous = this.appBoardMotion;
    this.render?.destroy();
    this.cancel();
    if (!before || before === this.appBoardMotion) return;
    const oldGame = new Chess(before);
    const newGame = new Chess(this.appBoardMotion);
    const changed = SQUARES.filter((square) => {
      const old = oldGame.get(square);
      const next = newGame.get(square);
      return old?.type !== next?.type || old?.color !== next?.color;
    });
    const sources = changed.filter((square) => oldGame.get(square));
    const destinations = changed.filter((square) => newGame.get(square));
    // Resets and jumps across many replay moves should not look like a single move.
    if (destinations.length > 4 || sources.length > 5) return;
    const transitions: { from: Square; to: Square; piece: Piece }[] = [];
    for (const to of destinations) {
      const piece = newGame.get(to)!;
      const index = sources.findIndex((from) => {
        const old = oldGame.get(from)!;
        return from !== to && old.color === piece.color && old.type === piece.type;
      });
      const promotionIndex =
        index < 0
          ? sources.findIndex((from) => {
              const old = oldGame.get(from)!;
              return (
                from !== to &&
                old.color === piece.color &&
                old.type === 'p' &&
                (to[1] === '8' || to[1] === '1')
              );
            })
          : index;
      if (promotionIndex >= 0) {
        const [from] = sources.splice(promotionIndex, 1);
        transitions.push({ from, to, piece });
      }
    }
    this.render = afterNextRender(
      () => {
        const host = this.element.nativeElement;
        if (
          host.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        )
          return;
        const side = host.getBoundingClientRect().width / 8;
        for (const { from, to, piece } of transitions) {
          const target = host.querySelector<HTMLElement>(`[data-square="${to}"] .piece`);
          if (!target?.animate || !side) continue;
          const direction = this.boardFlipped ? -1 : 1;
          const x = (from.charCodeAt(0) - to.charCodeAt(0)) * side * direction;
          const y = (Number(to[1]) - Number(from[1])) * side * direction;
          const delay =
            transitions.some((move) => move.piece.color !== piece.color) &&
            piece.color !== oldGame.turn()
              ? 260
              : 0;
          this.animations.push(
            target.animate(
              [
                { transform: `translate(${x}px, ${y}px)`, zIndex: '2' },
                { transform: 'translate(0, 0)', zIndex: '2' },
              ],
              { duration: 260, delay, easing: 'ease-in-out', fill: 'backwards' },
            ),
          );
        }
      },
      { injector: this.injector },
    );
  }

  private cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }

  ngOnDestroy(): void {
    this.render?.destroy();
    this.cancel();
  }
}
