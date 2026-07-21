import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TutorialScene } from './scenes/TutorialScene';
import { CombatScene } from './scenes/CombatScene';
import { HubScene } from './scenes/HubScene';
import { TreeScene } from './scenes/TreeScene';
import { RelicScene } from './scenes/RelicScene';
import { LoadoutScene } from './scenes/LoadoutScene';
import { SettingsScene } from './scenes/SettingsScene';
import { installTestHooks } from './debug/testHooks';
import { installPlaytimeTracker } from './telemetry';

// Game construction stays fully synchronous (unchanged boot timing —
// journey.mjs's reload/settle waits are tuned against this). The pixel
// font's load is kicked off as a side effect of importing ui/theme
// (transitively, via the scene imports above) the moment this module
// evaluates — see ui/theme.ts's `fontsReady`. BootScene.create() awaits it
// before starting the first text-rendering scene (Tutorial/Hub), running it
// in parallel with BootScene's own sprite/audio preload instead of
// serializing in front of the whole boot.
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
  scene: [
    BootScene,
    TutorialScene,
    CombatScene,
    HubScene,
    TreeScene,
    RelicScene,
    LoadoutScene,
    SettingsScene,
  ],
});
installTestHooks(game);
installPlaytimeTracker();
