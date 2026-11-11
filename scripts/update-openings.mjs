import { writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';

const revision = '3ba6b20d31b2e6125cb0e6a2e792f400717d9d39';
const openings = {};

for (const volume of ['a', 'b', 'c', 'd', 'e']) {
  const url = `https://raw.githubusercontent.com/lichess-org/chess-openings/${revision}/${volume}.tsv`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  const rows = (await response.text()).trimEnd().split('\n').slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    if (!eco || !name || !pgn) throw new Error(`Invalid opening row: ${row}`);
    const chess = new Chess();
    chess.loadPgn(pgn);
    const position = chess.fen().split(' ').slice(0, 4).join(' ');
    openings[position] = { eco, name };
  }
}

await writeFile('public/openings.json', JSON.stringify(openings) + '\n', 'utf8');
console.log(`Generated ${Object.keys(openings).length} opening positions from ${revision}.`);
