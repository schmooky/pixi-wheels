---
"pixi-wheels": patch
---

Speed presets ask for stops they can reach. `NORMAL` allows a single turn (its 4.2 s stop needed two turns of 5.3 s before), `TURBO` asks for 2.0 s, `CINEMATIC` asks for 8 s over one to six turns (it asked for 6.5 s with a three-turn minimum of 12 s). A unit test holds every preset's `stopDuration` inside its turn range. Demos on the docs site spin in five to eight seconds instead of nine to seventeen.
