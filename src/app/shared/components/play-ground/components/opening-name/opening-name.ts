import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '../../../../i18n/translate-pipe';

/** An entry of the opening database. */
interface Opening {
  /** ECO classification code. */
  eco: string;
  name: string;
}

/**
 * Displays the name of the most recent known opening among the given positions,
 * loaded from `openings.json`, with a retry option if loading fails.
 */
@Component({
  selector: 'app-opening-name',
  imports: [TranslatePipe],
  template: `
    @if (opening(); as opening) {
      <p class="opening" role="status">
        {{ opening.name }}
      </p>
    } @else {
      <p class="opening" role="status">
        {{ 'Good luck' | t }}
      </p>
    }
    @if (error()) {
      <p class="opening-error" role="alert">
        {{ 'Opening names could not be loaded.' | t }}
        <button type="button" (click)="load()">{{ 'Retry' | t }}</button>
      </p>
    }
  `,
  styles: `
    .opening, .opening-error {
      margin: 0;
      height: 45px;
      color: #ffdfbc;
      overflow-wrap: anywhere;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    a { color: inherit; }
    .opening-error { color: #ffb4ab; }
  `,
})
export class OpeningName {
  private readonly document = inject(DOCUMENT);
  /** FENs of the game in playing order; the latest position found in the database determines the name. */
  readonly positions = input.required<readonly string[]>();
  /** Openings keyed by the first four FEN fields (placement, turn, castling, en passant); `null` until loaded. */
  private readonly openings = signal<Record<string, Opening> | null>(null);
  /** Whether the last attempt to load the opening database failed. */
  readonly error = signal(false);
  /** The opening matching the latest known position, or `null` if none or not loaded yet. */
  readonly opening = computed(() => {
    const openings = this.openings();
    if (!openings) return null;
    const positions = this.positions();
    for (let i = positions.length - 1; i >= 0; i--) {
      const key = positions[i].split(' ').slice(0, 4).join(' ');
      if (Object.hasOwn(openings, key)) return openings[key];
    }
    return null;
  });

  constructor() {
    void this.load();
  }

  /** Fetches and validates the opening database; failures are logged and reflected in {@link OpeningName.error} rather than thrown. */
  async load(): Promise<void> {
    this.error.set(false);
    try {
      const response = await fetch(new URL('openings.json', this.document.baseURI));
      if (!response.ok) throw new Error(`Opening database request failed: ${response.status}`);
      const data: unknown = await response.json();
      if (!isOpeningDatabase(data)) throw new Error('Invalid opening database');
      this.openings.set(data);
    } catch (error) {
      console.error('Opening database could not be loaded', error);
      this.error.set(true);
    }
  }
}

/** Type guard: a non-empty object whose values all have string `eco` and `name`. */
function isOpeningDatabase(value: unknown): value is Record<string, Opening> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0 &&
    Object.values(value).every(
      (opening: unknown) =>
        typeof opening === 'object' &&
        opening !== null &&
        'eco' in opening &&
        typeof opening.eco === 'string' &&
        'name' in opening &&
        typeof opening.name === 'string',
    )
  );
}
