import { BLOCKS } from "./blocks.js";

// ════════════════════════════════════════════════════════════════
//  BUILT-IN BEHAVIOR REGISTRY
//  Each function receives (entity, config, game).
//  config  = the property values from blocks.js
//  entity  = live game object  { el, x, y, vx, vy, classes, blocks }
//  game    = the GameEngine instance (access all APIs from here)
// ════════════════════════════════════════════════════════════════

const BEHAVIORS = {

    // ── PHYSICS ─────────────────────────────────────────────────

    gravity(entity, cfg, game) {
        entity.vy -= cfg.force;
        entity.y  += entity.vy;
        if (entity.y <= 0) {
            entity.y  = 0;
            entity.vy = 0;
            if ((entity._jumpCount || 0) > 0) {
                entity._jumpCount = 0;
                game.emit("landed", entity);
            }
        }
        entity.el.style.bottom = entity.y + "px";
    },

    // Like gravity(), but it does not clamp to y=0.
    // Useful for platformers where "falling off the screen" should be detectable.
    gravityLoose(entity, cfg, game) {
        entity.vy -= cfg.force;
        entity.y  += entity.vy;
        entity.el.style.bottom = entity.y + "px";
    },

    jump()       { /* passive — triggered by game.handleJump() */ },
    doubleJump() { /* passive — triggered by game.handleJump() */ },

    health(entity, cfg, game) {
        if (entity._hp === undefined) entity._hp = cfg.hp;
        const hpEl = game._worldEl.querySelector(".hp");
        if (hpEl) hpEl.innerText = "HP: " + entity._hp;
    },

    shield(entity, cfg, game) {
        if (!entity._shieldActive) return;
        entity._shieldTimer -= 16;
        if (entity._shieldTimer <= 0) {
            entity._shieldActive = false;
            entity.el.classList.remove("shielded");
            game.emit("shieldExpired", entity);
        }
    },

    // ── MOVEMENT ────────────────────────────────────────────────

    speed(entity, cfg, game) {
        entity.x += cfg.velocity;
        entity.el.style.left = entity.x + "px";
        if (entity.x < -120) game.destroyEntity(entity);
    },

    scroll(entity, cfg, game) {
        entity.x += cfg.speed;
        if (entity.x <= cfg.loopAt) entity.x = cfg.resetTo;
        entity.el.style.left = entity.x + "px";
    },

    patrol(entity, cfg, game) {
        if (entity._patrolOrigin === undefined) entity._patrolOrigin = entity.x;
        if (entity._patrolDir    === undefined) entity._patrolDir    = 1;
        entity.x += cfg.speed * entity._patrolDir;
        if (Math.abs(entity.x - entity._patrolOrigin) >= cfg.range)
            entity._patrolDir *= -1;
        entity.el.style.left = entity.x + "px";
    },

    sine(entity, cfg, game) {
        if (entity._sineTick  === undefined) entity._sineTick  = 0;
        if (entity._sineBaseY === undefined) entity._sineBaseY = entity.y;
        entity._sineTick++;
        entity.y = entity._sineBaseY + Math.sin(entity._sineTick * cfg.frequency) * cfg.amplitude;
        entity.el.style.bottom = entity.y + "px";
    },

    // ── SPAWNING ────────────────────────────────────────────────

    spawn(entity, cfg, game) {
        if (Math.random() < cfg.rate) {
            const e = game.spawnFrom(cfg.template);
            game.emit("spawned", e);
        }
    },

    // ── COLLISION / INTERACTION ──────────────────────────────────

    hit(entity, cfg, game) {
        const player = game.getFirstByClass("player");
        if (!player) return;
        if (!game.checkCollision(entity, player)) return;

        if (player._shieldActive) return;                          // shield blocks hit

        const healthCfg = player.blocks.health;
        if (healthCfg) {
            if (player._hp === undefined) player._hp = healthCfg.hp;
            player._hp = Math.max(0, player._hp - 1);
            game.emit("playerHit", { hp: player._hp });
            game.destroyEntity(entity);
            if (player._hp <= 0) game._triggerGameOver(cfg.message);
        } else {
            game._triggerGameOver(cfg.message);
        }
    },

    // ── VISUAL ──────────────────────────────────────────────────

    rotate(entity, cfg, game) {
        entity._angle = (entity._angle || 0) + cfg.speed;
        entity.el.style.transform = `rotate(${entity._angle}deg)`;
    },

    fade(entity, cfg, game) {
        entity._fadeTick = (entity._fadeTick || 0) + 16;
        entity.el.style.opacity = Math.max(0, 1 - entity._fadeTick / cfg.duration);
        if (entity._fadeTick >= cfg.duration) game.destroyEntity(entity);
    },

    bounce(entity, cfg, game) {
        game.getEntitiesByClass("obstacle").forEach(obs => {
            if (obs !== entity && game.checkCollision(entity, obs))
                entity.vy = Math.abs(entity.vy) * cfg.damping;
        });
    },

    grow(entity, cfg, game) {
        entity._scale = Math.min((entity._scale || 1) + cfg.rate, cfg.max);
        entity.el.style.transform = `scale(${entity._scale})`;
    },

    // ════════════════════════════════════════════════════════════
    //  TEACHER EXTENSION POINT — add new built-in behaviors here
    //  Format:
    //  behaviorName(entity, cfg, game) { ... },
    //
    //  Or register at runtime in main.js:
    //  game.registerBehavior("name", (entity, cfg, game) => { ... });
    // ════════════════════════════════════════════════════════════
};

// ════════════════════════════════════════════════════════════════
//  GAME ENGINE
// ════════════════════════════════════════════════════════════════

export default class GameEngine {

    // ── CONSTRUCTOR ─────────────────────────────────────────────

    constructor(worldId, options = {}) {
        this._worldEl    = document.querySelector(`#${worldId}`);
        this._behaviors  = { ...BEHAVIORS };
        this._entities   = [];
        this._events     = {};
        this._frameId    = null;
        this._score      = 0;
        this._scoreRate  = options.scoreRate ?? 1;   // points per frame, 0 = manual only

        // State machine: idle → playing ⇄ paused → gameover / won → (restart) → playing
        this._state = "idle";

        // HUD elements (looked up once inside the world container)
        this._scoreEl = this._worldEl.querySelector(".score");
        this._msgEl   = this._worldEl.querySelector(".game-message");
        this._pauseEl = this._worldEl.querySelector(".pause-label");
        this._hpEl    = this._worldEl.querySelector(".hp");

        this._readEntities();
    }

    // ── ENTITY MANAGEMENT ───────────────────────────────────────

    _readEntities() {
        this._worldEl.querySelectorAll(".entity").forEach(el => {
            this._entities.push(this._createEntity(el));
        });
    }

    _createEntity(el) {
        const classes = Array.from(el.classList);
        const blocks  = {};
        classes.forEach(cls => {
            if (BLOCKS[cls]) blocks[cls] = BLOCKS[cls];
        });
        const entity = {
            el, classes, blocks,
            x:  parseFloat(el.dataset.x)         || 0,
            y:  parseFloat(el.dataset.y)         || 0,
            vx: parseFloat(el.dataset.velocityX) || 0,
            vy: parseFloat(el.dataset.velocityY) || 0,
        };
        el.style.position = "absolute";
        el.style.left     = entity.x + "px";
        el.style.bottom   = entity.y + "px";
        return entity;
    }

    /** Create a new entity from a class string and add it to the world */
    spawnFrom(classes, x = 820, y = 0) {
        const el = document.createElement("div");
        el.className  = "entity " + classes;
        el.dataset.x  = x;
        el.dataset.y  = y;
        this._worldEl.appendChild(el);
        const entity = this._createEntity(el);
        this._entities.push(entity);
        this.emit("entitySpawned", entity);
        return entity;
    }

    /** Remove an entity from the world */
    destroyEntity(entity) {
        entity._dead = true;
        entity.el.remove();
        this._entities = this._entities.filter(e => e !== entity);
        this.emit("entityDestroyed", entity);
    }

    getFirstByClass(cls)    { return this._entities.find(e => e.classes.includes(cls))   ?? null; }
    getEntitiesByClass(cls) { return this._entities.filter(e => e.classes.includes(cls)); }

    // ── COLLISION ───────────────────────────────────────────────

    checkCollision(a, b) {
        const r1 = a.el.getBoundingClientRect();
        const r2 = b.el.getBoundingClientRect();
        return !(r1.right < r2.left || r1.left > r2.right ||
                 r1.bottom < r2.top || r1.top  > r2.bottom);
    }

    checkCollisionAll(entity, arr) {
        return arr.filter(other => other !== entity && this.checkCollision(entity, other));
    }

    // ── BEHAVIOR REGISTRY ───────────────────────────────────────

    /** Add or override a behavior from main.js (for world-specific logic) */
    registerBehavior(name, fn) {
        this._behaviors[name] = fn;
        return this;
    }

    // ── SCORE ───────────────────────────────────────────────────

    addScore(n = 1) {
        this._score += n;
        if (this._scoreEl) this._scoreEl.innerText = "Score: " + Math.floor(this._score);
        this.emit("score", Math.floor(this._score));
    }

    setScore(n)  { this._score = n; if (this._scoreEl) this._scoreEl.innerText = "Score: " + n; }
    getScore()   { return Math.floor(this._score); }

    // ── EVENT BUS ───────────────────────────────────────────────

    on(event, fn)  { (this._events[event] ??= []).push(fn); return this; }
    emit(event, d) { this._events[event]?.forEach(fn => fn(d, this)); return this; }
    off(event, fn) { if (this._events[event]) this._events[event] = this._events[event].filter(f => f !== fn); }

    // ── LIFECYCLE ───────────────────────────────────────────────

    get state() { return this._state; }

    start() {
        if (this._state === "playing") return;
        this._state = "playing";
        if (this._msgEl) this._msgEl.style.display = "none";
        this.emit("start");
        if (!this._frameId) this._loop();
    }

    pause() {
        if (this._state !== "playing") return;
        this._state = "paused";
        if (this._pauseEl) this._pauseEl.style.display = "block";
        this.emit("pause");
    }

    resume() {
        if (this._state !== "paused") return;
        this._state = "playing";
        if (this._pauseEl) this._pauseEl.style.display = "none";
        this.emit("resume");
    }

    togglePause() {
        this._state === "paused" ? this.resume() : this.pause();
    }

    reset() {
        this._state  = "idle";
        this._score  = 0;
        if (this._scoreEl) this._scoreEl.innerText = "Score: 0";
        if (this._msgEl)   this._msgEl.style.display = "none";
        if (this._pauseEl) this._pauseEl.style.display = "none";

        // Remove dynamic entities; keep persistent ones
        this._entities.forEach(e => { if (!e.el.dataset.persistent) e.el.remove(); });
        this._entities = [];
        this._readEntities();
        this.emit("reset");
    }

    restart() {
        this.reset();
        this.start();
    }

    /** Call when the player reaches the goal */
    win(message = "You Win!") {
        if (this._state === "won") return;
        this._state = "won";
        this._showMessage(`${message}\nScore: ${this.getScore()}\nPress Space to restart`);
        this.emit("won", { score: this.getScore() });
    }

    _triggerGameOver(message = "Game Over!") {
        if (this._state === "gameover") return;
        this._state = "gameover";
        this._showMessage(`${message}\nScore: ${this.getScore()}\nPress Space to restart`);
        this.emit("gameover", { score: this.getScore() });
    }

    _showMessage(text) {
        if (!this._msgEl) return;
        this._msgEl.innerText = text;
        this._msgEl.style.display = "block";
    }

    // ── INPUT BRIDGE ────────────────────────────────────────────

    handleJump() {
        if (this._state === "gameover" || this._state === "won") { this.restart(); return; }
        if (this._state === "idle")    { this.start(); return; }
        if (this._state !== "playing") return;

        const player = this.getFirstByClass("player");
        if (!player) return;

        const cfg = player.blocks.doubleJump || player.blocks.jump;
        if (!cfg) return;

        const maxJumps = cfg.maxJumps || 1;
        if ((player._jumpCount || 0) < maxJumps) {
            player.vy = cfg.height || 10;
            player._jumpCount = (player._jumpCount || 0) + 1;
            this.emit("jumped", player);
        }
    }

    handlePause() {
        if (this._state === "playing" || this._state === "paused") this.togglePause();
    }

    /** Activate the shield block on the player */
    activateShield() {
        const player = this.getFirstByClass("player");
        if (!player?.blocks.shield) return;
        player._shieldActive = true;
        player._shieldTimer  = player.blocks.shield.duration;
        player.el.classList.add("shielded");
        this.emit("shieldActivated", player);
    }

    // ── GAME LOOP ───────────────────────────────────────────────

    _loop() {
        this._frameId = requestAnimationFrame(() => this._loop());
        if (this._state !== "playing") return;

        // Snapshot prevents mutation bugs when destroyEntity is called mid-loop
        [...this._entities].forEach(entity => {
            if (entity._dead) return;
            entity.classes.forEach(cls => {
                if (this._behaviors[cls]) {
                    this._behaviors[cls](entity, entity.blocks[cls] || {}, this);
                }
            });
        });

        if (this._scoreRate > 0) this.addScore(this._scoreRate);
    }

    // ════════════════════════════════════════════════════════════
    //  TEACHER EXTENSION POINT — add new world behaviors here:
    //
    //  World 2 platform collision example (call in main.js):
    //  game.registerBehavior("platform", (entity, cfg, game) => {
    //      const player = game.getFirstByClass("player");
    //      if (!player) return;
    //      if (game.checkCollision(entity, player) && player.vy <= 0) {
    //          const top = entity.el.getBoundingClientRect().top;
    //          const ph  = player.el.getBoundingClientRect().height;
    //          player.y  = entity.y + entity.el.offsetHeight;
    //          player.vy = 0;
    //          player._jumpCount = 0;
    //          player.el.style.bottom = player.y + "px";
    //      }
    //  });
    //
    //  World 2 goal block example:
    //  game.registerBehavior("goal", (entity, cfg, game) => {
    //      const player = game.getFirstByClass("player");
    //      if (player && game.checkCollision(entity, player)) game.win("Level Complete!");
    //  });
    // ════════════════════════════════════════════════════════════
}