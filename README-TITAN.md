# TITAN: THE ANCIENT COLOSSUS — boss mode

New main-menu mode **TITAN: THE ANCIENT COLOSSUS**. All original modes (campaign, survival,
monsters, TDM, practice), weapons, controls, progress and save data are untouched.

## Files added
| File | Role |
| --- | --- |
| `models/boss/stone-golem.glb` | Supplied rigged golem, optimized (≈300k → 120k triangles, 5.9 MB). Rig (24 bones), textures and `walk`/`run` clips preserved. |
| `js/titan_config.js` | Every tunable number: HP, phases, weak points, attack damage/cooldowns, difficulty. |
| `js/titan_anim.js` | AnimationMixer + procedural skeletal clips: idle, walk/run (from GLB), melee, ground smash, charge, summon, beam, stagger, core exposure, phase roar, death, intro awakening. Crossfades between states. |
| `js/titan_audio.js` | Procedural spatial audio (footsteps, impacts, roars, beam hum, meteors, prison, music stingers). |
| `js/titan_fx.js` | Pooled effects: instanced debris, dust, sparks, warning decals, shockwave rings, floating damage numbers, camera shake. |
| `js/titan_arena.js` | Ruined colossus arena: pillars, monoliths, low walls, cover rocks, braziers, AABB collision, destructible props. |
| `js/titan_boss.js` | Model load/validation, bone-attached hitboxes, weak points, damage, phase transitions, AI state machine and the five attacks. |
| `js/titan_mode.js` | Mode integration (`gmStart/gmUpdate/gmClear`), lighting per phase, boss HUD, intro cinematic (skippable), victory/defeat screens, restart/teardown, supply drops, debug API. |

Edited: `index.html` (menu button, boss HUD/intro/end screens), `style.css` (Titan styles, appended),
`js/core.js` (registers the 7 modules after the original scripts).

## Encounter
- **HP** 11,000 (v29: eased from 15,000; difficulty scales HP and damage). Player keeps the normal 100 HP. Single golem hits stay at or below ~25 HP on normal; the beam deals ~28 HP/s.
- **Phases**: I Awakening (100–65%), II Ancient Fury (65–30%: glowing cracks, faster, combos, meteor + prison unlocked), III Absolute Destruction (30–0%: beam unlocked, larger waves, more meteors, red atmosphere, shorter cooldowns). Each transition plays a roar animation with a brief damage shield.
- **Attacks** (each telegraphed by animation, sound and ground markers):
  1. *Heavy melee / stomp* — close range.
  2. *Earthquake Smash* — expanding shockwave; jump over it.
  3. *Colossus Charge* — red lane telegraph; sidestep. Hitting a wall/pillar stuns the golem.
  4. *Meteoric Rockfall* (phase II+) — marked impact circles.
  5. *Rock Prison* (phase II+) — spikes trap the player; mash Jump/Space (dash counts ×3) or get crushed.
  6. *Ancient Energy Beam* (phase III) — 3 s charge with laser sight, then a tracking beam; break line of sight with pillars. Afterwards the core vents (exposed).
- **Weak points**: head ×2 (critical, repeated hits stagger), core ×2.5 only when exposed (×0.6 closed), arms ×1.5 (heavy arm damage weakens that arm's blows), legs ×1.3 (slows the golem). Stagger opens a 6 s core window.
- **Rewards**: $2,500 + 1,500 XP, +$1,500 for a no-damage kill; best time saved.

## Verified in a headless browser
Model loads and validates; intro → fight; all five attack types hit and damage the player;
prison escape and crush; weak-point multipliers; phase II and III transitions; death
sequence → victory screen; defeat; restart (no duplicated objects); return to menu restores
the original map and colliders; survival mode still works afterwards; phone-landscape HUD.
Not verifiable without a real device: real-GPU frame rate, sound, and touch feel.

## Debug (browser console)
`__titan.report()`, `skip()`, `setHp(0.5)`, `damage(n, zone)`, `force('beam')`
(`melee|smash|charge|meteor|prison|beam`), `god(true)`, `hitboxes(true)`, `tp(x,z)`, `sim(seconds)`, `counts()`.
