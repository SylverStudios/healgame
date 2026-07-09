import Phaser from 'phaser';
import { SceneKeys } from './keys';
// TODO(chunk3): restore tutorial routing
// import { loadSave } from '../save/save';
import type { CombatSceneData } from './CombatScene';
import { ASH_GATE } from '../data/encounters';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    // TODO(chunk3): restore tutorial routing
    // const save = loadSave();
    // if (save.tutorialDone) {
    //   this.scene.start(SceneKeys.Hub);
    // } else {
    //   this.scene.start(SceneKeys.Tutorial);
    // }
    const combatData: CombatSceneData = {
      encounterId: ASH_GATE.id,
      spellIds: ['solemn-mend'],
      returnTo: SceneKeys.Hub,
    };
    this.scene.start(SceneKeys.Combat, combatData);
  }
}
