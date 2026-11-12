import { readFile, writeFile } from 'node:fs/promises';

const filename = process.argv[2];
const output = process.argv[3];
if (!filename || !output || process.argv.length !== 4) {
  console.error('Usage: node scripts/prepare-username-index.mjs <users-export.json> <new-index.json>');
  process.exitCode = 1;
} else {
  try {
    const users = JSON.parse(await readFile(filename, 'utf8'));
    if (users !== null && (typeof users !== 'object' || Array.isArray(users))) {
      throw new Error('The export must contain the /users object.');
    }

    const names = Object.create(null);
    const problems = [];
    for (const [uid, profile] of Object.entries(users ?? {})) {
      const username = profile?.username;
      if (
        typeof username !== 'string'
        || username.length < 4
        || username.length > 42
        || !/^[A-Za-z0-9_]+( [A-Za-z0-9_]+)*$/.test(username)
      ) {
        problems.push(`Invalid username for ${uid}: ${JSON.stringify(username)}`);
        continue;
      }
      const key = username.toLowerCase();
      if (Object.hasOwn(names, key)) {
        problems.push(`Duplicate username ${JSON.stringify(username)}: ${names[key]} and ${uid}`);
      } else {
        names[key] = uid;
      }
    }
    if (problems.length) {
      throw new Error(`Fix these profiles and export /users again:\n${problems.join('\n')}`);
    }
    await writeFile(output, `${JSON.stringify(names, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(`Prepared ${Object.keys(names).length} username reservations in ${output}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
