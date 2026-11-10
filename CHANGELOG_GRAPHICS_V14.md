# SHADOW STRIKE v14 — Graphics & Lighting Overhaul

## Main changes
- **Much less dark night**: the hemisphere fill light no longer copies the (near-black) sky color. It has its own sky/ground colors, so enemies, buildings and obstacles stay readable without the flashlight. The night keeps its dark blue sky, stars, moon and fog.
- **Lighting presets** (Settings > Iluminação): AUTO (day/night cycle that starts at night), DIA LIMPO (clear day), NUBLADO (cloudy), ENTARDECER (evening), NOITE HORROR (horror night). Weather (rain/fog/storm) blends on top of each one.
- **Brightness slider** (Settings > Brilho, 0.7–1.5).
- **PBR materials**: normal and roughness maps are generated from every procedural texture. Containers and barrels have real metalness. Wear and tear (dirt streaks, rust, cracks, scratches, bullet marks, moss) is added. Image-based lighting comes from the sky itself (PMREM).
- **3D models**: Lambert materials on weapons, soldiers and props are converted to PBR (metal guns, matte cloth). The GLB trees no longer look shiny. Grass tufts get per-instance color variation.
- **Shadows**: Low 512 / Medium 1024 / High 2048 / Ultra 4096 (capped at 2048 on phones). The shadow area follows the player with texel snapping (no shimmer). Bias tuned per profile. PCF soft shadows from Medium up.
- **Flashlight**: warmer, longer beam (38 m) with softer falloff and a subtle beam cone on High/Ultra (stronger in fog and rain). Intensity adapts to how dark the scene is. F key, 🔦 button and night vision all unchanged.
- **Effects**: star-shaped muzzle flash sprite plus a real muzzle light. Explosions now have fire, rising smoke, a light flash and a scorch mark on the ground. Bullet impacts leave textured holes and dust puffs. All lights are pooled, so there are no shader recompile stutters.
- **Environment storytelling**: burn marks, oil puddles (glossy), rubble and scattered shell casings. These are flat decals with no collision. The emergency lights have a visible red lamp and a slow, controlled pulse.
- **Image**: ACES exposure per preset, a subtle vignette, and light saturation/contrast grading on High/Ultra.
- **Performance**: resolution adapts automatically (drops to 65% when FPS stays under 32, then recovers). On first launch the quality profile is picked automatically (phone = Medium/High, desktop = High). Ultra textures use per-pixel micro-detail instead of hundreds of thousands of canvas strokes. Start-up timeout raised to 45 s for slow phones.
- **Interface**: Barlow Condensed / Share Tech Mono fonts with a fallback, angled tactical buttons with entry animation, segmented health bar, new crosshair, restyled ammo/radar/messages and a loading bar. All button positions and controls are unchanged.

## Modified files
- js/graphics.js (NEW): presets, PBR, shadows, effects, decals, flashlight, adaptive resolution
- js/core.js: loads graphics.js, new save fields (lp, bri), automatic quality, 45 s timeout
- js/engine.js: quality table (shadows/aniso/textures), faster micro-detail for high-res textures, no more color-undefined warnings
- js/weapons.js: explosion uses a pooled light (gfxBoom) instead of creating a new PointLight each time
- js/game.js: hooks gfxPostStart, lighting preset and brightness controls
- index.html: Iluminação/Brilho settings, vignette, loading bar, fonts
- style.css: new interface block (v14)

## How to run
Serve the `game/` folder (`npx serve game` or `python3 -m http.server`) and open it in the browser. Internet is needed for the Three.js r128 CDN.
