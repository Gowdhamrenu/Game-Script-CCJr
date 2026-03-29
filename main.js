import GameEngine from "./engine.js";

// ════════════════════════════════════════════════════════════════
//  SELECT WORLD
//  Switch the ID below to load a different game world.
//  The world must exist as <div id="..."> in index.html.
// ════════════════════════════════════════════════════════════════

// World selection is controlled by HTML (students only edit index.html):
// <div id="game" data-active-world="world-runner"> (or world-platformer / world-dodger / world-shooter)
const ACTIVE_WORLD =
    document.querySelector("#game")?.dataset?.activeWorld ||
    document.body?.dataset?.activeWorld || // fallback (older version)
    "world-runner";

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════

const game = new GameEngine(ACTIVE_WORLD, {
    scoreRate: ACTIVE_WORLD === "world-shooter" ? 0 : 1,   // points per frame (shooter scores via hits)
});

// Shared input state for worlds that need it.
game._input = {
    left: false,
    right: false,
    shoot: false,
};

// ════════════════════════════════════════════════════════════════
//  REGISTER WORLD-SPECIFIC BEHAVIORS
//  Add behaviors that are unique to this world and shouldn't
//  live in the engine permanently. See engine.js comments for
//  examples (platform, goal, etc.)
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// WORLD 2: PLATFORMER
// ════════════════════════════════════════════════════════════════
game.registerBehavior("platform", (entity, cfg, game) => {
    const player = game.getFirstByClass("player");
    if (!player) return;
    if (!game.checkCollision(entity, player)) return;
    if (player.vy > 0) return; // only land while falling

    player.y = entity.y + entity.el.offsetHeight;
    player.vy = 0;
    player._jumpCount = 0;
    player.el.style.bottom = player.y + "px";
});

game.registerBehavior("goal", (entity, cfg, game) => {
    const player = game.getFirstByClass("player");
    if (player && game.checkCollision(entity, player)) {
        game.win("Level Complete!");
    }
});

game.registerBehavior("fallKill", (entity, cfg, game) => {
    if (entity.y <= (cfg.killBelow ?? -80)) {
        game._triggerGameOver(cfg.message ?? "Fell off the world!");
    }
});

// ════════════════════════════════════════════════════════════════
// WORLD 3: TOP-DOWN DODGER
// ════════════════════════════════════════════════════════════════════════
game.registerBehavior("topdownMove", (entity, cfg, game) => {
    const dir = (game._input.right ? 1 : 0) - (game._input.left ? 1 : 0);
    const speed = cfg.speed ?? 4;
    entity.x += dir * speed;

    const worldW = game._worldEl.clientWidth;
    const maxX = (cfg.maxX ?? worldW) - entity.el.offsetWidth;
    const minX = cfg.minX ?? 0;
    entity.x = Math.max(minX, Math.min(maxX, entity.x));
    entity.el.style.left = entity.x + "px";
});

game.registerBehavior("fall", (entity, cfg, game) => {
    const speed = cfg.speed ?? 3;
    entity.y -= speed;
    entity.el.style.bottom = entity.y + "px";

    if (entity.y <= (cfg.outBelow ?? -80)) game.destroyEntity(entity);
});

game.registerBehavior("spawnRain", (entity, cfg, game) => {
    if (Math.random() >= (cfg.rate ?? 0.02)) return;

    const xMin = cfg.xMin ?? 10;
    const xMax = cfg.xMax ?? 790;
    const ySpawn = cfg.ySpawn ?? 280;
    const x = xMin + Math.random() * (xMax - xMin);

    game.spawnFrom(cfg.template ?? "obstacle fall hit", x, ySpawn);
});

if (ACTIVE_WORLD === "world-dodger") {
    // ~10 seconds at scoreRate=1 (60fps * 10s = ~600 frames)
    const WIN_SCORE = 600;
    game.on("score", (total) => {
        if (total >= WIN_SCORE) game.win("You survived the rain!");
    });
}

// ════════════════════════════════════════════════════════════════
// WORLD 4: SPACE SHOOTER
// ════════════════════════════════════════════════════════════════
game.registerBehavior("shipMove", (entity, cfg, game) => {
    const dir = (game._input.right ? 1 : 0) - (game._input.left ? 1 : 0);
    const speed = cfg.speed ?? 5;
    entity.x += dir * speed;

    const worldW = game._worldEl.clientWidth;
    const maxX = (cfg.maxX ?? worldW) - entity.el.offsetWidth;
    const minX = cfg.minX ?? 0;
    entity.x = Math.max(minX, Math.min(maxX, entity.x));
    entity.el.style.left = entity.x + "px";
});

game.registerBehavior("shooter", (entity, cfg, game) => {
    if (!game._input.shoot) return;

    const now = performance.now();
    const cooldownMs = cfg.cooldownMs ?? 250;
    const nextAt = entity._nextShotAt ?? 0;
    if (now < nextAt) return;

    const template = cfg.bulletTemplate ?? "bullet bulletMove bulletHit";
    const offX = cfg.bulletOffsetX ?? 18;
    const offY = cfg.bulletOffsetY ?? 10;

    game.spawnFrom(template, entity.x + offX, entity.y + offY);
    entity._nextShotAt = now + cooldownMs;
});

game.registerBehavior("bulletMove", (entity, cfg, game) => {
    const speed = cfg.speed ?? 10;
    entity.y += speed;
    entity.el.style.bottom = entity.y + "px";
    if (entity.y >= (cfg.outAbove ?? 320)) game.destroyEntity(entity);
});

game.registerBehavior("bulletHit", (entity, cfg, game) => {
    const enemies = game.getEntitiesByClass("enemy");
    if (!enemies.length) return;

    for (const enemy of [...enemies]) {
        if (!game.checkCollision(entity, enemy)) continue;

        game.destroyEntity(enemy);
        game.destroyEntity(entity);
        game.addScore(cfg.score ?? 10);
        break;
    }
});

game.registerBehavior("enemyMove", (entity, cfg, game) => {
    const speed = cfg.speed ?? 2;
    entity.y -= speed;
    entity.el.style.bottom = entity.y + "px";
    if (entity.y <= (cfg.outBelow ?? -90)) game.destroyEntity(entity);
});

game.registerBehavior("spawnWave", (entity, cfg, game) => {
    game._enemiesSpawned = game._enemiesSpawned ?? 0;
    const totalEnemies = cfg.totalEnemies ?? 40;

    // Spawn while we still have quota.
    if (game._enemiesSpawned < totalEnemies) {
        if (Math.random() < (cfg.rate ?? 0.02)) {
            const xMin = cfg.xMin ?? 20;
            const xMax = cfg.xMax ?? 780;
            const x = xMin + Math.random() * (xMax - xMin);
            const ySpawn = cfg.ySpawn ?? 285;

            game.spawnFrom(cfg.template ?? "enemy enemyMove hit", x, ySpawn);
            game._enemiesSpawned++;
        }
        return;
    }

    // Win once spawning is done and there are no enemies alive.
    if (game.getEntitiesByClass("enemy").length === 0) {
        game.win("All enemies cleared!");
    }
});

// Ensure shooter spawning state doesn't leak across restarts.
game.on("reset", () => {
    if (ACTIVE_WORLD === "world-shooter") game._enemiesSpawned = 0;
});

// Example — difficulty ramp: speed up spawn rate as score grows
game.on("score", (total) => {
    const spawner = game.getFirstByClass("spawner");
    if (!spawner?.blocks?.spawn) return;
    // Every 200 points, increase spawn rate slightly (caps at 0.06)
    spawner.blocks.spawn.rate = Math.min(0.02 + total * 0.00004, 0.06);
});

// ════════════════════════════════════════════════════════════════
//  EVENTS
// ════════════════════════════════════════════════════════════════

game.on("gameover", ({ score }) => {
    console.log("Game over — final score:", score);
    // Add any custom game-over UI here (high score, animations, etc.)
});

game.on("won", ({ score }) => {
    console.log("Level complete — score:", score);
});

game.on("playerHit", ({ hp }) => {
    // Flash player red when health-based hit occurs
    const player = game.getFirstByClass("player");
    if (!player) return;
    player.el.classList.add("hit-flash");
    setTimeout(() => player.el.classList.remove("hit-flash"), 300);
});

// ════════════════════════════════════════════════════════════════
//  INPUT — KEYBOARD
// ════════════════════════════════════════════════════════════════

document.addEventListener("keydown", (e) => {
    switch (e.code) {
        case "Space":
        case "ArrowUp":
            e.preventDefault();
            game.handleJump();
            break;

        case "KeyP":
        case "Escape":
            game.handlePause();
            break;

        case "ArrowLeft":
            e.preventDefault();
            game._input.left = true;
            break;
        case "ArrowRight":
            e.preventDefault();
            game._input.right = true;
            break;

        case "KeyX":
            if (ACTIVE_WORLD === "world-shooter" && game.state === "playing") {
                e.preventDefault();
                game._input.shoot = true;
            }
            break;

        // ── ADD WORLD-SPECIFIC KEYS BELOW ───────────────────────
        // case "ArrowLeft":  movePlayerLeft();  break;
        // case "ArrowRight": movePlayerRight(); break;
        // case "KeyS":       game.activateShield(); break;
    }
});

document.addEventListener("keyup", (e) => {
    switch (e.code) {
        case "ArrowLeft":
            game._input.left = false;
            break;
        case "ArrowRight":
            game._input.right = false;
            break;
        case "KeyX":
            game._input.shoot = false;
            break;
    }
});

// ════════════════════════════════════════════════════════════════
//  INPUT — TOUCH (mobile)
// ════════════════════════════════════════════════════════════════

document.addEventListener("touchstart", (e) => {
    e.preventDefault();
    game.handleJump();
}, { passive: false });

// ════════════════════════════════════════════════════════════════
//  START
//  The game waits for first Space/tap before running.
//  Or call game.start() here to auto-start.
// ════════════════════════════════════════════════════════════════

// Show "Press Space to start" on load
const msgEl = document.querySelector(`#${ACTIVE_WORLD} .game-message`);
if (msgEl) {
    if (ACTIVE_WORLD === "world-dodger") {
        msgEl.innerText = "Press Space to Start\nUse Arrow Keys to Move";
    } else if (ACTIVE_WORLD === "world-shooter") {
        msgEl.innerText = "Press Space to Start\nX to Shoot";
    } else if (ACTIVE_WORLD === "world-platformer") {
        msgEl.innerText = "Press Space to Start\nArrow Keys to Move";
    } else {
        msgEl.innerText = "Press Space to Start";
    }
    msgEl.style.display = "block";
}

// Start loop (waits for first input due to state machine)
game._loop();