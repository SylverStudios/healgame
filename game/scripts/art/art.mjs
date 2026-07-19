#!/usr/bin/env node
/**
 * Deterministic frame tooling for the PixelLab art pipeline.
 * Style law: art/STYLE.md · registry: art/manifest.json · workflow:
 * .claude/skills/pixellab-art-pipeline/SKILL.md
 *
 * Usage (from game/): npm run art -- <command> [options] [paths...]
 *
 *   validate [--size N] <png|dir...>      exact canvas, alpha, color count
 *   crop --size N --out <dir|file> [--bottom-pad P] <png|dir...>
 *                                         union-bbox crop, bottom-center anchor
 *   sheet --out <file> <png|dir...>       concat equal-size frames into one row
 *   preview --out <file> [--scale N] [--durations a,b,..] <png|dir...>
 *                                         HTML player honoring exposure sheet
 *   diff <a.png> <b.png>                  pixel-compare two PNGs (exit 1 if differ)
 *   audit [--root <dir>] [--manifest <file>]
 *                                         check art/manifest.json against disk
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function readPng(file) {
  try {
    return PNG.sync.read(fs.readFileSync(file));
  } catch (err) {
    fail(`cannot read ${file}: ${err.message}`);
  }
}

function writePng(file, png) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

/** Numeric-aware sort so 2.png < 10.png. */
function frameSort(a, b) {
  const na = Number.parseInt(path.basename(a), 10);
  const nb = Number.parseInt(path.basename(b), 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

/** Expand dir args into their sorted *.png contents; keep file args as-is. */
function expandInputs(args) {
  const files = [];
  for (const arg of args) {
    if (!fs.existsSync(arg)) fail(`no such path: ${arg}`);
    if (fs.statSync(arg).isDirectory()) {
      const pngs = fs
        .readdirSync(arg)
        .filter((f) => f.toLowerCase().endsWith('.png'))
        .map((f) => path.join(arg, f))
        .sort(frameSort);
      if (pngs.length === 0) fail(`no PNGs in directory: ${arg}`);
      files.push(...pngs);
    } else {
      files.push(arg);
    }
  }
  if (files.length === 0) fail('no input PNGs given');
  return files;
}

/** Parse --flag value pairs; returns { flags, rest }. */
function parseArgs(argv, spec) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (!(name in spec)) fail(`unknown option --${name}`);
      if (spec[name] === 'bool') {
        flags[name] = true;
      } else {
        i++;
        if (i >= argv.length) fail(`--${name} needs a value`);
        flags[name] = argv[i];
      }
    } else {
      rest.push(arg);
    }
  }
  return { flags, rest };
}

function opaqueBbox(png, alphaThreshold = 0) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(png.width * y + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function colorStats(png) {
  const colors = new Set();
  let transparent = false;
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3];
    if (a === 0) {
      transparent = true;
      continue;
    }
    colors.add((png.data[i] << 24) | (png.data[i + 1] << 16) | (png.data[i + 2] << 8) | a);
  }
  return { colorCount: colors.size, hasTransparency: transparent };
}

// ---------------------------------------------------------------- validate

function cmdValidate(argv) {
  const { flags, rest } = parseArgs(argv, { size: 'value' });
  const size = flags.size === undefined ? null : Number(flags.size);
  const files = expandInputs(rest);
  let errors = 0;
  for (const file of files) {
    const png = readPng(file);
    const { colorCount, hasTransparency } = colorStats(png);
    const problems = [];
    if (size !== null) {
      const isSheet = path.basename(file) === 'sheet.png';
      if (isSheet) {
        if (png.height !== size || png.width % size !== 0) {
          problems.push(`sheet must be N×${size}×${size}, got ${png.width}x${png.height}`);
        }
      } else if (png.width !== size || png.height !== size) {
        problems.push(`expected ${size}x${size}, got ${png.width}x${png.height}`);
      }
    }
    if (!hasTransparency) problems.push('no transparent background');
    // Sheets aggregate unique colors across all frames — only single frames get the palette check.
    if (path.basename(file) !== 'sheet.png' && colorCount > 32) {
      problems.push(`palette heavy (${colorCount} colors; STYLE.md aims ≤ ~24)`);
    }
    const status = problems.length === 0 ? 'ok ' : 'FAIL';
    console.log(
      `${status} ${file} ${png.width}x${png.height} colors=${colorCount}` +
        (problems.length > 0 ? ` — ${problems.join('; ')}` : ''),
    );
    if (problems.length > 0) errors++;
  }
  if (errors > 0) fail(`${errors}/${files.length} files failed validation`);
  console.log(`${files.length} files ok`);
}

// ---------------------------------------------------------------- crop

function cmdCrop(argv) {
  const { flags, rest } = parseArgs(argv, { size: 'value', out: 'value', 'bottom-pad': 'value' });
  if (flags.size === undefined || flags.out === undefined) fail('crop needs --size and --out');
  const size = Number(flags.size);
  const pad = flags['bottom-pad'] === undefined ? 1 : Number(flags['bottom-pad']);
  const files = expandInputs(rest);
  const pngs = files.map((f) => ({ file: f, png: readPng(f) }));

  // One shared window across all frames so the figure never jitters.
  let union = null;
  for (const { file, png } of pngs) {
    const box = opaqueBbox(png);
    if (box === null) fail(`${file} is fully transparent`);
    union =
      union === null
        ? box
        : {
            minX: Math.min(union.minX, box.minX),
            minY: Math.min(union.minY, box.minY),
            maxX: Math.max(union.maxX, box.maxX),
            maxY: Math.max(union.maxY, box.maxY),
          };
  }
  const bw = union.maxX - union.minX + 1;
  const bh = union.maxY - union.minY + 1;
  if (bw > size || bh + pad > size) {
    fail(
      `figure (${bw}x${bh} + ${pad}px foot pad) overflows ${size}x${size} — ` +
        'tighten the motion prompt or use the next canvas tier (art/STYLE.md)',
    );
  }
  const left = union.minX - Math.floor((size - bw) / 2);
  const top = union.maxY + 1 + pad - size;

  const singleFile = files.length === 1 && flags.out.toLowerCase().endsWith('.png');
  for (const { file, png } of pngs) {
    const out = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = left + x;
        const sy = top + y;
        if (sx < 0 || sy < 0 || sx >= png.width || sy >= png.height) continue;
        const si = (png.width * sy + sx) * 4;
        const di = (size * y + x) * 4;
        out.data[di] = png.data[si];
        out.data[di + 1] = png.data[si + 1];
        out.data[di + 2] = png.data[si + 2];
        out.data[di + 3] = png.data[si + 3];
      }
    }
    const target = singleFile ? flags.out : path.join(flags.out, path.basename(file));
    writePng(target, out);
    console.log(`cropped ${file} -> ${target}`);
  }
  console.log(`window x=${left} y=${top} size=${size} (figure ${bw}x${bh}, foot pad ${pad})`);
}

// ---------------------------------------------------------------- sheet

function cmdSheet(argv) {
  const { flags, rest } = parseArgs(argv, { out: 'value' });
  if (flags.out === undefined) fail('sheet needs --out');
  const files = expandInputs(rest);
  const pngs = files.map((f) => ({ file: f, png: readPng(f) }));
  const { width, height } = pngs[0].png;
  for (const { file, png } of pngs) {
    if (png.width !== width || png.height !== height) {
      fail(`frame size mismatch: ${file} is ${png.width}x${png.height}, expected ${width}x${height}`);
    }
  }
  const out = new PNG({ width: width * pngs.length, height });
  pngs.forEach(({ png }, i) => PNG.bitblt(png, out, 0, 0, width, height, i * width, 0));
  writePng(flags.out, out);
  console.log(`sheet ${flags.out}: ${pngs.length} frames of ${width}x${height} (${out.width}x${height})`);
}

// ---------------------------------------------------------------- preview

function cmdPreview(argv) {
  const { flags, rest } = parseArgs(argv, { out: 'value', scale: 'value', durations: 'value' });
  if (flags.out === undefined) fail('preview needs --out');
  const scale = flags.scale === undefined ? 4 : Number(flags.scale);
  const files = expandInputs(rest);
  const pngs = files.map((f) => readPng(f));
  const { width, height } = pngs[0];
  let durations = files.map(() => 120);
  if (flags.durations !== undefined) {
    durations = flags.durations.split(',').map((s) => Number(s.trim()));
    if (durations.length !== files.length || durations.some((d) => !Number.isFinite(d) || d < 0)) {
      fail(`--durations needs ${files.length} comma-separated ms values (0 skips a frame)`);
    }
  }
  const frames = files.map((f, i) => ({
    name: path.basename(f),
    ms: durations[i],
    src: `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`,
  }));
  const html = `<!-- generated by \`npm run art -- preview\` — not hand-edited -->
<meta charset="utf-8"><title>art preview</title>
<style>
  body { background:#1a1210; color:#cbb; font:14px monospace; display:flex;
         flex-direction:column; align-items:center; gap:12px; padding-top:40px; }
  img { image-rendering: pixelated; width:${width * scale}px; height:${height * scale}px;
        outline:1px solid #443; }
  button { font:inherit; background:#2a201c; color:#cbb; border:1px solid #443; }
</style>
<img id="v" alt="frame">
<div id="label"></div>
<div><button id="toggle">pause</button> <button id="step">step</button></div>
<script>
  const frames = ${JSON.stringify(frames)};
  const active = frames.filter(f => f.ms > 0);
  let i = 0, playing = true, timer = null;
  const v = document.getElementById('v'), label = document.getElementById('label');
  function show() {
    const f = active[i];
    v.src = f.src;
    label.textContent = \`frame \${i} (\${f.name}) — \${f.ms}ms — \${active.length} frames\`;
  }
  function tick() {
    show();
    if (!playing) return;
    timer = setTimeout(() => { i = (i + 1) % active.length; tick(); }, active[i].ms);
  }
  document.getElementById('toggle').onclick = () => {
    playing = !playing;
    document.getElementById('toggle').textContent = playing ? 'pause' : 'play';
    clearTimeout(timer);
    if (playing) tick();
  };
  document.getElementById('step').onclick = () => {
    playing = false;
    document.getElementById('toggle').textContent = 'play';
    clearTimeout(timer);
    i = (i + 1) % active.length;
    show();
  };
  tick();
</script>`;
  fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
  fs.writeFileSync(flags.out, html);
  console.log(`preview ${flags.out}: ${frames.length} frames at ${scale}x — open in a browser`);
}

// ---------------------------------------------------------------- diff

function cmdDiff(argv) {
  const { rest } = parseArgs(argv, {});
  if (rest.length !== 2) fail('diff needs exactly two PNG paths');
  const a = readPng(rest[0]);
  const b = readPng(rest[1]);
  if (a.width !== b.width || a.height !== b.height) {
    fail(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  let differing = 0;
  let first = null;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (a.width * y + x) * 4;
      // Fully transparent pixels are equal regardless of RGB.
      if (a.data[i + 3] === 0 && b.data[i + 3] === 0) continue;
      if (
        a.data[i] !== b.data[i] ||
        a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2] ||
        a.data[i + 3] !== b.data[i + 3]
      ) {
        differing++;
        if (first === null) first = { x, y };
      }
    }
  }
  if (differing === 0) {
    console.log('identical');
  } else {
    console.log(`${differing} differing pixels (first at ${first.x},${first.y})`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- audit

function cmdAudit(argv) {
  const { flags } = parseArgs(argv, { root: 'value', manifest: 'value' });
  const root = flags.root === undefined ? REPO_ROOT : path.resolve(flags.root);
  const manifestPath =
    flags.manifest === undefined ? path.join(root, 'art', 'manifest.json') : path.resolve(flags.manifest);
  if (!fs.existsSync(manifestPath)) fail(`no manifest at ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let errors = 0;
  let warnings = 0;
  const planned = [];

  for (const unit of manifest.units) {
    const dir = path.join(root, unit.assetsDir);
    const tag = `${unit.slug} (${unit.archetype}, ${unit.nativeSize}px ${unit.facing})`;
    if (unit.status === 'planned') {
      planned.push(tag + (unit.note !== undefined ? ` — ${unit.note}` : ''));
      continue;
    }
    if (!fs.existsSync(dir)) {
      console.log(`FAIL ${tag}: assets dir missing: ${unit.assetsDir}`);
      errors++;
      continue;
    }
    if (unit.status === 'legacy') {
      console.log(`warn ${tag}: legacy density (${unit.canvas}) — ${unit.replacePlan ?? 'queued for regen'}`);
      warnings++;
      continue;
    }
    // live + tight: enforce the density law.
    const problems = [];
    for (const [name, strip] of Object.entries(unit.strips)) {
      if (strip.status === 'planned') {
        planned.push(`${unit.slug}/${name}` + (strip.note !== undefined ? ` — ${strip.note}` : ''));
        continue;
      }
      if (strip.file !== undefined) {
        const file = path.join(dir, strip.file);
        if (!fs.existsSync(file)) {
          problems.push(`missing ${strip.file}`);
          continue;
        }
        const png = readPng(file);
        const expectedW = strip.file === 'sheet.png' ? unit.nativeSize * strip.frames : unit.nativeSize;
        if (png.width !== expectedW || png.height !== unit.nativeSize) {
          problems.push(`${strip.file} is ${png.width}x${png.height}, expected ${expectedW}x${unit.nativeSize}`);
        }
      }
      if (strip.dir !== undefined) {
        const stripDir = path.join(dir, strip.dir);
        if (!fs.existsSync(stripDir)) {
          problems.push(`missing ${strip.dir}/`);
          continue;
        }
        const frames = fs.readdirSync(stripDir).filter((f) => f.endsWith('.png'));
        if (frames.length !== strip.frames) {
          problems.push(`${strip.dir}/ has ${frames.length} frames, manifest says ${strip.frames}`);
        }
        for (const frame of frames) {
          const png = readPng(path.join(stripDir, frame));
          if (png.width !== unit.nativeSize || png.height !== unit.nativeSize) {
            problems.push(`${strip.dir}/${frame} is ${png.width}x${png.height}, expected ${unit.nativeSize}px`);
          }
        }
      }
    }
    if (problems.length === 0) {
      console.log(`ok   ${tag}`);
    } else {
      console.log(`FAIL ${tag}: ${problems.join('; ')}`);
      errors++;
    }
  }

  if (planned.length > 0) {
    console.log(`\nplanned (${planned.length}):`);
    for (const p of planned) console.log(`  - ${p}`);
  }
  console.log(`\naudit: ${errors} errors, ${warnings} legacy warnings`);
  if (errors > 0) process.exit(1);
}

// ---------------------------------------------------------------- main

const [command, ...argv] = process.argv.slice(2);
const commands = {
  validate: cmdValidate,
  crop: cmdCrop,
  sheet: cmdSheet,
  preview: cmdPreview,
  diff: cmdDiff,
  audit: cmdAudit,
};
if (command === undefined || !(command in commands)) {
  console.error('usage: npm run art -- <validate|crop|sheet|preview|diff|audit> [options] [paths...]');
  console.error('see header of game/scripts/art/art.mjs for details');
  process.exit(command === undefined ? 0 : 1);
}
commands[command](argv);
