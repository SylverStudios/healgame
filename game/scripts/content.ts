import { CONTENT_CATALOGS } from '../src/data/content/catalogs';
import { formatContentDiagnostics } from '../src/data/content/compile';
import { formatDungeonPreview } from '../src/data/content/preview';
import { validateContent } from '../src/data/content/validate';
import { ORDERED_DUNGEONS } from '../src/data/dungeons';

const usage = `Usage:
  npm run content -- validate
  npm run content -- list
  npm run content -- preview <dungeon-id>
  npm run content -- preview --all`;

function validateOrExit(): void {
  const result = validateContent(CONTENT_CATALOGS);
  for (const warning of result.warnings) {
    console.warn(`warning [${warning.code}] ${warning.path}: ${warning.message}`);
  }
  if (!result.valid) {
    console.error(formatContentDiagnostics(result.errors));
    process.exit(1);
  }
}

function unlockSummary(dungeon: (typeof ORDERED_DUNGEONS)[number]): string {
  return dungeon.unlock.kind === 'always'
    ? 'always unlocked'
    : `unlocks after ${dungeon.unlock.dungeonId}`;
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'validate':
    if (args.length !== 0) {
      console.error(usage);
      process.exit(1);
    }
    validateOrExit();
    console.log(
      `Content valid: ${CONTENT_CATALOGS.dungeons.length} dungeons, ${CONTENT_CATALOGS.mobs.length} mobs, ${CONTENT_CATALOGS.abilities.length} abilities`,
    );
    break;

  case 'list':
    if (args.length !== 0) {
      console.error(usage);
      process.exit(1);
    }
    validateOrExit();
    for (const dungeon of ORDERED_DUNGEONS) {
      console.log(`${dungeon.order}. ${dungeon.name} [${dungeon.id}] — ${unlockSummary(dungeon)}`);
    }
    break;

  case 'preview':
    validateOrExit();
    if (args.length !== 1) {
      console.error(usage);
      process.exit(1);
    }
    if (args[0] === '--all') {
      console.log(
        ORDERED_DUNGEONS.map((dungeon) => formatDungeonPreview(dungeon, CONTENT_CATALOGS)).join(
          '\n\n',
        ),
      );
      break;
    }
    try {
      console.log(formatDungeonPreview(args[0]!, CONTENT_CATALOGS));
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    break;

  default:
    console.error(usage);
    process.exit(1);
}
