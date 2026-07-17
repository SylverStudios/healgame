import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TutorialScene } from './scenes/TutorialScene';
import { CombatScene } from './scenes/CombatScene';
import { HubScene } from './scenes/HubScene';
import { TreeScene } from './scenes/TreeScene';
import { RelicScene } from './scenes/RelicScene';
import { LoadoutScene } from './scenes/LoadoutScene';
import { installTestHooks } from './debug/testHooks';
import { installPlaytimeTracker } from './telemetry';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1a1210',
  // Nearest-neighbor texture filtering game-wide — 16×16 tiles stay crisp at
  // any display size (docs/research/pixel-art-pipeline.md).
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TutorialScene, CombatScene, HubScene, TreeScene, RelicScene, LoadoutScene],
});
installTestHooks(game);
installPlaytimeTracker();
