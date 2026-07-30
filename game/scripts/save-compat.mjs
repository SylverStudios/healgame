/**
 * Exit codes:
 *   0 — golden fixture validates under current SaveData rules
 *   2 — incompatible (fixture fails validateSaveData) — verify may auto-bump
 *   1 — I/O / malformed fixture / unexpected error
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const gameRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = join(gameRoot, 'src/save/fixtures/golden-save.json');
const saveModuleUrl = pathToFileURL(join(gameRoot, 'src/save/save.ts')).href;

let raw;
try {
  raw = readFileSync(fixturePath, 'utf8');
} catch (err) {
  console.error(`save-compat: cannot read fixture ${fixturePath}: ${err.message}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(`save-compat: malformed JSON in golden fixture: ${err.message}`);
  process.exit(1);
}

const { validateSaveData, SAVE_SCHEMA, SAVE_KEY } = await tsImport(saveModuleUrl, import.meta.url);

if (!validateSaveData(parsed)) {
  console.error(
    `save-compat: golden fixture incompatible with schema ${SAVE_SCHEMA} (${SAVE_KEY})`,
  );
  process.exit(2);
}

console.log(`save-compat: ok (schema ${SAVE_SCHEMA}, ${SAVE_KEY})`);
process.exit(0);
