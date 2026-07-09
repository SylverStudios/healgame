import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TutorialScene } from './scenes/TutorialScene';
import { CombatScene } from './scenes/CombatScene';
import { HubScene } from './scenes/HubScene';
import { TreeScene } from './scenes/TreeScene';
import { SubclassScene } from './scenes/SubclassScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1a1210',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TutorialScene, CombatScene, HubScene, TreeScene, SubclassScene],
});
