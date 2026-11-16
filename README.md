# SALTDOWN — a three.js tactical FPS

SALTDOWN (map: **Saltline**) is a round-based, Counter-Strike-*style* tactical FPS built
for the make.fun `threejs-fps-02` bounty. Everything is original: the map, the names,
the weapons, the sounds and every texture — all generated in code, no assets.

## Play

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome and click **Deploy**. No build step, no
network — the page is static ES modules with three.js 0.187.0 vendored.

## The game

- **5v5 bomb defusal** — you plus 4 attacker bots vs 5 defender bots (map *Saltline*,
  sites **A** and **B**).
- Attackers carry a charge: plant it inside a site (hold E), defend it to detonation;
  defenders break the plant (hold E on the charge, faster with a Defusal Kit).
- Rounds are won by elimination, detonation or defuse; first to 7 rounds wins the match.
- **Economy**: credits each round, a buy menu (B) with 4 weapons, frag grenades, armor
  and a defusal kit. Loss streak bonuses keep comebacks alive.
- **Gunplay**: hits against body and head boxes (headshot multipliers), recoil and spread
  that grow while moving, crouching tightens aim, first-shot accuracy matters.
- **Bots**: BFS pathing over a waypoint graph, per-role brains — push sites, hold angles,
  engage on sight and sound, chase a dropped charge, plant and defuse.

## Controls

| Input | Action |
| --- | --- |
| Mouse | look, fire |
| WASD | move (Shift crouch, Space jump) |
| R | reload |
| B | buy menu (freeze time) |
| E | plant / defuse (hold) |
| G | frag grenade |
| 1 / 2 | primary / sidearm |

## Code layout (game/src)

| Module | Job |
| --- | --- |
| `config.js` | every tunable in one place: palette, weapons, physics, rounds, economy |
| `mapdata.js` | Saltline as pure data: boxes, waypoints, sites, spawns |
| `textures.js` | procedural canvas textures — containers, concrete, asphalt, hazard stripes |
| `scene.js` | renderer, lights with shadow mapping, all map meshes |
| `physics.js` | swept AABB movement with step-up, raycasts, line-of-sight |
| `weapons.js` | weapon state machine: fire, spread, recoil, reload |
| `actors.js` | actor bodies, hitboxes, damage, meshes |
| `bots.js` | waypoint BFS + bot brains (push / hold / engage / plant / defuse) |
| `player.js` | input and first-person movement |
| `rounds.js` | the match state machine: freeze → live → end, bomb logic, economy |
| `audio.js` | fully synthesized WebAudio (shots, impacts, plant/defuse, detonation) |
| `fx.js` | pooled tracers, sparks, muzzle flash, explosion — zero hot-loop allocation |
| `hud.js` | health/ammo/credits, round timer, kill feed, buy menu, banners |
| `main.js` | boot + fixed-step 60 Hz simulation loop, kept apart from rendering |

## Screenshots

`node shots.mjs` (needs `playwright`) renders the four screenshots in `screenshots/` from
the game's own staged states (`?shot=…` query parameters) in headless Chromium.

## Hand-in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

writes `out/game/`, `out/screenshots/` and `out/dossier.json` exactly as the grader
expects.

## License

MIT — see [LICENSE](LICENSE).
