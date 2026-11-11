import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';

interface Opening {
  eco: string;
  name: string;
}

@Component({
  selector: 'app-opening-name',
  template: `
    @if (opening(); as opening) {
      <p class="opening" role="status">
        {{ opening.name }}
      </p>
    }
    @if (error()) {
      <p class="opening-error" role="alert">
        Opening names could not be loaded.
        <button type="button" (click)="load()">Retry</button>
      </p>
    }
  `,
  styles: `
    .opening, .opening-error {
      margin: 12px 0;
      color: #ffdfbc;
      text-align: center;
      overflow-wrap: anywhere;
    }
    a { color: inherit; }
    .opening-error { color: #ffb4ab; }
  `,
})
export class OpeningName {
  private readonly document = inject(DOCUMENT);
  readonly positions = input.required<readonly string[]>();
  private readonly openings = signal<Record<string, Opening> | null>(null);
  readonly error = signal(false);
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
