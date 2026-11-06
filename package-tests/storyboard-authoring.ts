import {compileStoryboard, readStoryboard, STORYBOARD_VERSION, type Storyboard, type StoryboardScene} from '@dom-director/core/storyboard';
import type {Tour} from '@dom-director/core';
const scene = {id:'overview',title:'Overview',target:'app.reports',description:'Read the overview.',durationMs:3500,transitionMs:900,maxScale:2,cursor:true} as const satisfies StoryboardScene;
const board = {version:STORYBOARD_VERSION,id:'example',title:'Example',locale:'en',scenes:[scene]} as const satisfies Storyboard;
const generated = compileStoryboard(board);
if (generated.ok) {
  const tour:Tour = generated.value;
  const restored = readStoryboard(tour);
  if (restored.ok) {
    const duration:number = restored.value.scenes[0].durationMs;
    void duration;
    // @ts-expect-error imported storyboard snapshots are readonly
    restored.value.scenes.push(scene);
  }
} else {
  const code:string = generated.diagnostics[0].code;
  void code;
}
// @ts-expect-error storyboard pointer selection is a boolean, not a DOM event
const invalid:StoryboardScene = {...scene,cursor:'click'};
// @ts-expect-error unsupported compact storyboard format
const wrongVersion:Storyboard = {...board,version:2};
void invalid;void wrongVersion;
