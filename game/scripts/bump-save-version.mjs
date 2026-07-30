/**
 * Deterministic save-schema bump: schema' = schema + 1.
 *
 * Updates save-version.json, LEGACY_SAVE_KEYS, package.json (0.N.0),
 * package-lock top-level version, and regenerates the golden fixture.
 *
 * Flags / env:
 *   --check or SAVE_BUMP=0 — refuse to write (CI hermetic path)
 *
 * Usage (from game/): node scripts/bump-save-version.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const gameRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly =
  process.argv.includes('--check') || process.env.SAVE_BUMP === '0';

const versionPath = join(gameRoot, 'src/save/save-version.json');
const saveTsPath = join(gameRoot, 'src/save/save.ts');
const packagePath = join(gameRoot, 'package.json');
const lockPath = join(gameRoot, 'package-lock.json');
const fixturePath = join(gameRoot, 'src/save/fixtures/golden-save.json');

const versionJson = JSON.parse(readFileSync(versionPath, 'utf8'));
const oldSchema = versionJson.schema;
if (typeof oldSchema !== 'number' || !Number.isInteger(oldSchema)) {
  console.error(`bump-save-version: invalid schema in ${versionPath}`);
  process.exit(1);
}
const newSchema = oldSchema + 1;
const oldKey = `healgame-save-v${oldSchema}`;
const newKey = `healgame-save-v${newSchema}`;
const newPkgVersion = `0.${newSchema}.0`;

if (checkOnly) {
  console.error(
    `save schema incompatible; run npm run save:bump locally and commit (${oldSchema}→${newSchema})`,
  );
  process.exit(1);
}

const touched = [];

// 1. save-version.json
writeFileSync(versionPath, `{ "schema": ${newSchema} }\n`);
touched.push('src/save/save-version.json');

// 2. LEGACY_SAVE_KEYS — append retired key if absent
let saveTs = readFileSync(saveTsPath, 'utf8');
if (!saveTs.includes(`'${oldKey}'`)) {
  const marker = 'export const LEGACY_SAVE_KEYS = [';
  const start = saveTs.indexOf(marker);
  const end = saveTs.indexOf('] as const;', start);
  if (start < 0 || end < 0) {
    console.error('bump-save-version: could not locate LEGACY_SAVE_KEYS array in save.ts');
    process.exit(1);
  }
  const before = saveTs.slice(0, end);
  const after = saveTs.slice(end);
  const trimmedBefore = before.replace(/\s+$/, '');
  const withComma = trimmedBefore.endsWith(',') ? trimmedBefore : `${trimmedBefore},`;
  saveTs = `${withComma}\n  '${oldKey}',\n${after}`;
  writeFileSync(saveTsPath, saveTs);
  touched.push('src/save/save.ts');
}

// 3. package.json version → 0.${newSchema}.0
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.version = newPkgVersion;
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
touched.push('package.json');

// 4. package-lock.json top-level version fields
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  lock.version = newPkgVersion;
  if (lock.packages?.['']) {
    lock.packages[''].version = newPkgVersion;
  }
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  touched.push('package-lock.json');
} catch {
  // lock optional
}

// 5. Regenerate golden fixture from newSaveData (after schema file is updated)
const saveModuleUrl = pathToFileURL(join(gameRoot, 'src/save/save.ts')).href;
const { newSaveData, SAVE_SCHEMA, SAVE_KEY, validateSaveData } = await tsImport(
  saveModuleUrl,
  import.meta.url,
);
if (SAVE_SCHEMA !== newSchema || SAVE_KEY !== newKey) {
  console.error(
    `bump-save-version: module still reports schema ${SAVE_SCHEMA} / ${SAVE_KEY} after write`,
  );
  process.exit(1);
}
const fresh = newSaveData('lattice');
if (!validateSaveData(fresh)) {
  console.error('bump-save-version: newSaveData() failed validateSaveData after bump');
  process.exit(1);
}
writeFileSync(fixturePath, `${JSON.stringify(fresh, null, 2)}\n`);
touched.push('src/save/fixtures/golden-save.json');

// 6. Assert healgame-save-v references under src/ + scripts/ are current + legacy only
let rgOut = '';
try {
  rgOut = execFileSync('rg', ['-n', 'healgame-save-v', 'src', 'scripts'], {
    cwd: gameRoot,
    encoding: 'utf8',
  });
} catch (err) {
  if (err.status === 1) {
    rgOut = '';
  } else {
    try {
      rgOut = execFileSync('grep', ['-rn', 'healgame-save-v', 'src', 'scripts'], {
        cwd: gameRoot,
        encoding: 'utf8',
      });
    } catch (gErr) {
      if (gErr.status === 1) rgOut = '';
      else throw gErr;
    }
  }
}

const allowed = new Set([newKey]);
const legacyMatch = saveTs.match(/export const LEGACY_SAVE_KEYS = \[([\s\S]*?)\] as const;/);
if (legacyMatch) {
  for (const m of legacyMatch[1].matchAll(/'(healgame-save-v\d+)'/g)) {
    allowed.add(m[1]);
  }
}

const bad = [];
for (const line of rgOut.split('\n').filter(Boolean)) {
  const keys = line.match(/healgame-save-v\d+/g) ?? [];
  for (const k of keys) {
    if (!allowed.has(k)) {
      bad.push(line);
      break;
    }
  }
}
if (bad.length) {
  console.error('bump-save-version: unexpected healgame-save-v references:');
  for (const line of bad) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `bump-save-version: ${oldSchema}→${newSchema} (${oldKey}→${newKey}, pkg ${newPkgVersion}); touched: ${touched.join(', ')}`,
);
process.exit(0);
