import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DE } from './de';

const ROOT = join(process.cwd(), 'src', 'app');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(html|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

// Keys are the English texts used with the `t` pipe, `tr()` and `I18n.t()`.
const PATTERNS = [
  /(['"`])((?:\\.|(?!\1)[^\\])+)\1\s*\|\s*t\b/g,
  /\btr\(\s*(['"`])((?:\\.|(?!\1)[^\\])+)\1\s*\)/g,
  /\.t\(\s*(['"`])((?:\\.|(?!\1)[^\\])+)\1/g,
];

function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const file of sourceFiles(ROOT)) {
    if (file.includes(join('shared', 'i18n'))) continue;
    const text = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        keys.set(match[2].replace(/\\(['"`\\])/g, '$1'), file.replace(ROOT, 'src/app'));
      }
    }
  }
  return keys;
}

describe('German translations', () => {
  it('should contain every English text that the application translates', () => {
    const missing = [...usedKeys()]
      .filter(([key]) => !(key in DE))
      .map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('should keep the placeholders of the English text', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    const broken = Object.entries(DE)
      .filter(([key, value]) => placeholders(key).join() !== placeholders(value).join())
      .map(([key]) => key);
    expect(broken).toEqual([]);
  });

  it('should not translate to an empty text', () => {
    expect(Object.entries(DE).filter(([, value]) => !value.trim())).toEqual([]);
  });
});
