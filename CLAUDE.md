# EVO - Human Evolution Game

## Project Overview
A web-based game about human evolution from Neanderthals through the far future. Players guide a civilization through 10 eras while experiencing strategy, simulation, and adventure through a character who lives, ages, dies, and passes the torch to the next generation.

## Tech Stack
- **Build**: Vite + TypeScript (ES modules)
- **Rendering**: PixiJS v8 (WebGPU/WebGL)
- **UI**: Vanilla HTML/CSS over canvas (no React/Vue)
- **Audio**: Howler.js
- **Save**: IndexedDB via `idb`
- **Test**: Vitest
- **Path alias**: `@/` maps to `src/`

## Architecture
Subsystem pattern inspired by Unreal Engine. All game systems extend `SubsystemBase<TState>` and communicate via a typed `EventBus` (pub/sub). No direct subsystem references.

### Key Systems
- `GameWorld` (`src/core/GameWorld.ts`) — Master orchestrator
- `EventBus` (`src/core/EventBus.ts`) — Typed event system, add events to `GameEvents` interface
- `GameLoop` (`src/core/GameLoop.ts`) — Fixed 10Hz tick + variable render
- 8 subsystems in `src/subsystems/`: Era, Resource, Population, TechTree, Character, Environment, Event, NPC

### Cross-subsystem Communication
- Subsystems NEVER import each other directly
- Use `EventBus` events for loose coupling
- GameWorld wires callbacks via `registerCallbacks()` for resource spending and effect application

## Critical Design Principles
1. **Era transitions must be SLOW and NATURAL** — gradual visual blending, no sudden switches
2. **Living world with NPCs** — characters age, die, and have relationships
3. **Character succession** — on death, player chooses next character from family or acquaintances
4. **Futuristic aesthetics ONLY in future eras** — historically appropriate visuals per era
5. **Mixed gameplay** — strategy/management + simulation + adventure

## 10 Eras (in order)
`dawn` → `awakening` → `roots` → `forge` → `empire` → `convergence` → `enlightenment` → `revolution` → `modern` → `horizon`

## Folder Structure
```
src/
  core/         — Engine: GameWorld, GameLoop, EventBus, SubsystemBase, SaveManager
  subsystems/   — Game logic (one file per system)
  rendering/    — PixiJS: SceneManager, scenes/, components/, filters/
  ui/           — HTML/CSS: UIManager, panels/, components/, styles/
  data/         — Static game data: eras/, technologies/, events/, resources, buildings
  types/        — TypeScript interfaces
  utils/        — Math, formatting, easing helpers
  assets/       — Sprites, backgrounds, textures
```

## Commands
- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npx tsc --noEmit` — Type check
- `npm test` — Run Vitest

## Coding Conventions
- TypeScript strict mode enabled
- No React — UI is direct DOM manipulation via UIManager
- All game data in `src/data/` as typed TypeScript modules
- CSS glassmorphism for Modern/Future eras; era-appropriate panels for earlier eras
- PixiJS v8 API: `new Application()` then `await app.init(opts)`, Graphics chain: `.rect().fill()`
- Events use string literal keys in `GameEvents` interface

## Reference Project
Design inspired by AEON (`C:\Users\herro\dev\GitHub\aeon-game`) — an Unreal Engine 5.7 space RPG with similar subsystem architecture, legacy/succession mechanics, and glassmorphism UI.
