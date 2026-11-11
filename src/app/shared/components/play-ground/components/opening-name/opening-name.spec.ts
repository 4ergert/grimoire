import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chess } from 'chess.js';
import { vi } from 'vitest';
import { OpeningName } from './opening-name';

describe('OpeningName', () => {
  let fixture: ComponentFixture<OpeningName>;
  const chess = new Chess();
  const initial = chess.fen();
  chess.move('e4');
  const e4 = chess.fen();
  chess.move('e5');
  const e4e5 = chess.fen();
  chess.move('Nf3');
  const later = chess.fen();
  const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
  const data = {
    [key(e4)]: { eco: 'B00', name: "King's Pawn" },
    [key(e4e5)]: { eco: 'C20', name: "King's Pawn Game" },
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    }));
    TestBed.configureTestingModule({ imports: [OpeningName] });
    fixture = TestBed.createComponent(OpeningName);
    fixture.componentRef.setInput('positions', [initial]);
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('updates and retains the most recent named position, including when rewinding', async () => {
    await fixture.whenStable();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(fixture.componentInstance.opening()).toBeNull());
    fixture.componentRef.setInput('positions', [initial, e4, e4e5, later]);
    await vi.waitFor(() => expect(fixture.componentInstance.opening()?.eco).toBe('C20'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("King's Pawn Game");
    fixture.componentRef.setInput('positions', [initial, e4]);
    expect(fixture.componentInstance.opening()?.eco).toBe('B00');
    fixture.componentRef.setInput('positions', [initial]);
    expect(fixture.componentInstance.opening()).toBeNull();
  });

  it('reports an invalid database and permits retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bad: { eco: 42, name: 'Invalid' } }),
    } as Response);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.error()).toBe(true);
    expect(log).toHaveBeenCalled();
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.error()).toBe(false);
    fixture.componentRef.setInput('positions', [initial, e4]);
    expect(fixture.componentInstance.opening()?.eco).toBe('B00');
  });
});
