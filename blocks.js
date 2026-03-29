export const BLOCKS = {};
export function defineBlock(name, config) { BLOCKS[name] = config; }

// ════════════════════════════════════════════════════════════════
//  BLOCKS — Properties only. Logic lives entirely in engine.js.
//  Format:  defineBlock("name", { property: value });
//  Usage:   Add the block name as a CSS class to any .entity
// ════════════════════════════════════════════════════════════════

// ── PHYSICS ──────────────────────────────────────────────────────
defineBlock("gravity",    { force: 0.4 });
defineBlock("gravityLoose", { force: 0.4 });
defineBlock("jump",       { height: 10, maxJumps: 1 });
defineBlock("doubleJump", { height: 10, maxJumps: 2 });

// ── MOVEMENT ─────────────────────────────────────────────────────
defineBlock("speed",      { velocity: -4 });
defineBlock("scroll",     { speed: -2,  loopAt: -1600, resetTo: 0 });
defineBlock("patrol",     { range: 200, speed: 2 });
defineBlock("sine",       { amplitude: 40, frequency: 0.05 });

// ── SPAWNING ─────────────────────────────────────────────────────
defineBlock("spawn",      { rate: 0.02, template: "obstacle speed hit" });

// ── INTERACTION ──────────────────────────────────────────────────
defineBlock("hit",        { message: "Game Over!" });
defineBlock("health",     { hp: 3 });
defineBlock("shield",     { duration: 2000 });

// ── VISUAL ───────────────────────────────────────────────────────
defineBlock("rotate",     { speed: 3 });
defineBlock("fade",       { duration: 1000 });
defineBlock("bounce",     { damping: 0.8 });
defineBlock("grow",       { rate: 0.01, max: 2.0 });

// ── WORLD 2: PLATFORMER ─────────────────────────────────────────
defineBlock("fallKill", { killBelow: -80, message: "Fell off the world!" });

// ── WORLD 3: TOP-DOWN DODGER ────────────────────────────────────
defineBlock("topdownMove", { speed: 4 });
defineBlock("spawnRain", {
    rate: 0.03,
    template: "obstacle fall hit",
    xMin: 10,
    xMax: 770,
    ySpawn: 280
});
defineBlock("fall", { speed: 3, outBelow: -80 });

// ── WORLD 4: SPACE SHOOTER ───────────────────────────────────────
defineBlock("shipMove", { speed: 5 });
defineBlock("shooter", {
    cooldownMs: 250,
    bulletTemplate: "bullet bulletMove bulletHit",
    bulletOffsetX: 18,
    bulletOffsetY: 10
});
defineBlock("bulletMove", { speed: 10, outAbove: 320 });
defineBlock("bulletHit", { score: 10 });
defineBlock("enemyMove", { speed: 2.2, outBelow: -90 });
defineBlock("spawnWave", {
    rate: 0.02,
    template: "enemy enemyMove hit",
    xMin: 20,
    xMax: 780,
    ySpawn: 285,
    totalEnemies: 40,
    // Win is handled in main.js by "when all enemies are cleared".
});