
// Runner Game Logic

// Define available skins
const RUNNER_SKINS = [
    { name: 'Triangle', color: '#00CED1', shape: 'triangle' },
    { name: 'Square', color: '#FF69B4', shape: 'square' },
    { name: 'Circle', color: '#FFD700', shape: 'circle' },
    { name: 'Diamond', color: '#9370DB', shape: 'diamond' },
    { name: 'Star', color: '#FF4500', shape: 'star' },
    { name: 'Pentagon', color: '#32CD32', shape: 'pentagon' },
    { name: 'Hexagon', color: '#FF1493', shape: 'hexagon' },
    { name: 'Arrow', color: '#00BFFF', shape: 'arrow' }
];

class RunnerGame {
    constructor() {
        this.canvas = document.getElementById('runner-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isActive = false;
        this.isPaused = true;

        // Game State
        this.width = 0;
        this.height = 0;

        this.player = {
            x: 50,
            y: 0,
            width: 30,
            height: 30,
            vy: 0,
            isGrounded: false,
            jumpStrength: -12,
            gravity: 0.6,
            skinIndex: 0 // Current skin
        };

        this.obstacles = [];
        this.obstacleTimer = 0;
        this.obstacleInterval = 120; // Frames
        this.gameSpeed = 5;
        this.score = 0; // Local session score (not used much, mostly we add to global money)

        this.mode = 'cube';
        this.gravityScale = 1;

        this.lastTime = 0;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input
        document.addEventListener('keydown', (e) => {
            if (!this.isActive || this.isPaused) return;
            if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
                e.preventDefault(); // Stop scrolling
                this.jump();
            }
        });

        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.isActive || this.isPaused) return;
            e.preventDefault(); // Prevent scrolling
            this.jump();
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.isActive || this.isPaused) return;
            this.jump();
        });
    }

    resize() {
        // Fullscreen canvas within the container
        const container = document.getElementById('runner-container');
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Ground level is 50px from bottom
        this.groundY = this.height - 50;
    }

    jump() {
        if (this.mode === 'ship') {
            // Ship mode allows mid-air jumps (flapping)
            this.player.vy = this.player.jumpStrength * this.gravityScale;
            if (window.soundManager) window.soundManager.playJump();
        } else if (this.player.isGrounded) {
            this.player.vy = this.player.jumpStrength * this.gravityScale;
            this.player.isGrounded = false;
            if (window.soundManager) window.soundManager.playJump();
        }
    }

    start() {
        this.isActive = true;
        this.isPaused = false;
        this.gameLoop();
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        if (this.isActive && this.isPaused) {
            this.isPaused = false;
            this.gameLoop();
        }
    }

    update() {
        // --- 1. Physics Update ---
        const gravityDir = this.gravityScale; // 1 or -1

        if (this.mode === 'cube') {
            // Normal Gravity Physics
            this.player.vy += this.player.gravity * gravityDir;
            this.player.y += this.player.vy;
        } else if (this.mode === 'ship') {
            // Ship / Fly Physics
            // Gravity always pulls "down" relative to screen (or relative to gravityScale? Geometry Dash ship flips with gravity)
            // Let's assume ship always falls down, click pushes up.
            // If gravity is flipped, ship falls up, click pushes down.

            // Apply Gravity
            this.player.vy += this.player.gravity * 0.6 * gravityDir; // Lighter gravity for ship

            // Cap Velocity for control
            const maxV = 8;
            if (this.player.vy > maxV) this.player.vy = maxV;
            if (this.player.vy < -maxV) this.player.vy = -maxV;

            this.player.y += this.player.vy;
        }

        // --- 2. Ground/Ceiling Collision (World Bounds) ---
        // Normal Gravity (scale 1): Ground at groundY, Ceiling at 0?
        // Inverse Gravity (scale -1): Ground at 0, Ceiling at groundY?

        if (gravityDir === 1) {
            // Standard Floor
            if (this.player.y + this.player.height >= this.groundY) {
                if (this.mode === 'cube') {
                    this.player.y = this.groundY - this.player.height;
                    this.player.vy = 0;
                    this.player.isGrounded = true;
                } else {
                    // Ship touches floor -> Crash (in strict mode) or Slide? 
                    // Let's slide for forgiveness, or make it bounce? 
                    // User said: "if not click he falls" -> usually implies death in Flappy Bird, but let's just Slide for now to be nice.
                    this.player.y = this.groundY - this.player.height;
                    this.player.vy = 0;
                }
            }
            // Ceiling (for ship)
            if (this.player.y < 0) {
                this.player.y = 0;
                this.player.vy = 0;
            }

        } else {
            // Inverted Physics
            // "Floor" is now the top (y=0)
            if (this.player.y <= 0) {
                if (this.mode === 'cube') {
                    this.player.y = 0;
                    this.player.vy = 0;
                    this.player.isGrounded = true;
                } else {
                    this.player.y = 0;
                    this.player.vy = 0;
                }
            }
            // "Ceiling" is bottom
            if (this.player.y + this.player.height >= this.groundY) {
                this.player.y = this.groundY - this.player.height;
                this.player.vy = 0;
            }
        }

        // --- 3. Obstacle Logic ---
        this.obstacleTimer++;

        // Dynamic Interval: Ship mode spawns much faster (more obstacles)
        const currentInterval = this.mode === 'ship' ? 15 : this.obstacleInterval;

        if (this.obstacleTimer > currentInterval) {
            this.spawnObstacle();
            this.obstacleTimer = 0;
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.x -= this.gameSpeed;

            // Collision Check
            if (!obs.hit && !obs.passed) {
                if (this.checkCollision(this.player, obs)) {

                    if (obs.type === 'portal_fly') {
                        this.switchMode('ship');
                        obs.hit = true; // One time use
                    } else if (obs.type === 'portal_gravity') {
                        // GREEN: Force Inverse + Cube
                        this.switchMode('cube');
                        this.setGravity(-1);
                        obs.hit = true;
                    } else if (obs.type === 'portal_normal') {
                        // ORANGE: Force Normal + Cube
                        this.switchMode('cube');
                        this.resetGravity();
                        obs.hit = true;
                    } else if (['platform', 'floating'].includes(obs.type)) {
                        // Landable Obstacles (Pink Platform & Gold Floating Block)

                        // Check relative position to decide if we land or crash
                        const prevY = this.player.y - this.player.vy; // Approximation of previous position

                        let landed = false;

                        // Normal Gravity
                        if (this.gravityScale === 1) {
                            // Check if we were previously ABOVE the platform
                            // Tolerance: +15 pixels overlap allowed for smooth landing
                            const wasAbove = prevY + this.player.height <= obs.y + 15;

                            if (wasAbove && this.player.vy >= 0) {
                                // Landed!
                                this.player.y = obs.y - this.player.height;
                                this.player.vy = 0;
                                this.player.isGrounded = true;
                                landed = true;
                            }
                        }
                        // Inverted Gravity
                        else {
                            // Check if we were previously BELOW the platform (visually higher Y)
                            const wasBelow = prevY >= obs.y + obs.height - 15;

                            if (wasBelow && this.player.vy <= 0) {
                                // Landed (on the "bottom")
                                this.player.y = obs.y + obs.height;
                                this.player.vy = 0;
                                this.player.isGrounded = true;
                                landed = true;
                            }
                        }

                        // If we intersected but didn't land presumably we hit the side or bottom -> Crash
                        if (!landed) {
                            this.hitObstacle();
                        }

                    } else if (['normal', 'spike', 'floor_spike', 'ceiling_spike', 'tall'].includes(obs.type)) {
                        // Red/Dangerous Obstacles (and Purple Walls)
                        this.hitObstacle();
                        obs.hit = true;
                    }
                }
            }

            // Remove off-screen
            if (obs.x + obs.width < -100) {
                this.obstacles.splice(i, 1);
            }
            // Reward handling
            if (!obs.passed && obs.x + obs.width < this.player.x) {
                obs.passed = true;
                if (!obs.hit && !['portal_fly', 'portal_gravity', 'portal_normal'].includes(obs.type)) {
                    this.rewardPlayer(obs.value || 10);
                }
            }
        }
    }

    switchMode(newMode) {
        this.mode = newMode;
        // Don't reset Vy completely if switching to ship to allow smooth transition? 
        // Actually reseting is safer to avoid momentum glitches
        this.player.vy = 0;
        this.showFloatingText(`${newMode.toUpperCase()} MODE!`, this.width / 2, this.height / 2, '#FFF');
    }

    setGravity(scale) {
        // Only trigger if changing
        if (this.gravityScale !== scale) {
            this.gravityScale = scale;
            this.player.vy = 0;
            this.isGrounded = false;
            this.showFloatingText(scale === 1 ? "NORMAL GRAVITY" : "INVERTED!", this.width / 2, this.height / 2, '#00FF00');
        }
    }

    resetGravity() {
        this.setGravity(1);
    }

    checkRectCollision(rect1, rect2) {
        return (rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y);
    }

    checkCollision(player, obs) {
        // Wrapper for specialized collisions (like portals needing touch vs platforms needing landing)
        // For general "overlap", use rect collision
        return this.checkRectCollision(player, obs);
    }


    spawnObstacle() {
        // Occasional Portal (10% chance if no portal recently?)
        // For simplicity, just use random roll
        const typeRoll = Math.random();

        // Portals (Very rare, or specific logic?)
        // Let's make them 5% each?
        if (typeRoll < 0.05) {
            this.spawnPortal('portal_fly', '#00CED1'); // Cyan
            return;
        } else if (typeRoll < 0.10) {
            this.spawnPortal('portal_gravity', '#32CD32'); // Lime
            return;
        } else if (typeRoll < 0.15) {
            this.spawnPortal('portal_normal', '#FFA500'); // Orange
            return;
        }

        let type = 'normal';
        let y, width, height, color;

        if (this.mode === 'ship') {
            // Ship Mode: Spawn obstacles anywhere, including edges
            const shipRoll = Math.random();

            if (shipRoll < 0.25) {
                // Ceiling Obstacle (25%)
                type = 'ceiling_spike';
                width = 30 + Math.random() * 20;
                height = 40 + Math.random() * 40;
                y = 0; // Attached to top
                color = '#FF4500'; // Red Orange
            } else if (shipRoll < 0.50) {
                // Floor Obstacle (25%)
                type = 'floor_spike';
                width = 30 + Math.random() * 20;
                height = 40 + Math.random() * 40;
                y = this.groundY - height; // Attached to bottom
                color = '#FF4500';
            } else {
                // Floating Obstacle (Middle - 50%)
                type = 'floating';
                width = 40 + Math.random() * 30;
                height = 30 + Math.random() * 40;
                // Random Y between 20 and groundY - 20 (avoid completely blocking, but cover more area)
                y = 20 + Math.random() * (this.groundY - height - 40);
                color = '#b1b1b1'; // Grey-ish
            }

        } else if (typeRoll < 0.35) { // Adjusted probabilities
            // Floating Block
            type = 'floating';
            width = 40 + Math.random() * 30;
            height = 30;
            // Float relative to "Ground" (wherever that is)
            // If gravity 1: Float above bottom.
            // If gravity -1: Float below top.

            const dist = 60 + Math.random() * 40;
            if (this.gravityScale === 1) {
                y = this.groundY - dist;
            } else {
                y = dist; // From top
            }
            color = '#FFD700'; // Gold
        } else if (typeRoll < 0.55) {
            // High Wall
            type = 'tall';
            width = 20;
            height = 70 + Math.random() * 30;
            if (this.gravityScale === 1) {
                y = this.groundY - height;
            } else {
                y = 0;
            }
            color = '#8A2BE2'; // Violet
        } else if (typeRoll < 0.75) {
            // Spike
            type = 'spike';
            width = 30;
            height = 30;
            if (this.gravityScale === 1) {
                y = this.groundY - height;
            } else {
                y = 0;
            }
            color = '#FF4500'; // Red Orange
        } else if (typeRoll < 0.80) {
            // Normal Block
            type = 'normal';
            width = 30 + Math.random() * 40;
            height = 40 + Math.random() * 30;
            if (this.gravityScale === 1) {
                y = this.groundY - height;
            } else {
                y = 0;
            }
            color = '#ff4444';
        } else {
            // Platform (Safe to stand on) - Pink Big Square
            type = 'platform';
            width = 60;
            height = 60;
            // Place it slightly above ground so you can jump ON it
            if (this.gravityScale === 1) {
                y = this.groundY - 60;
            } else {
                y = 0; // Inverted platform at top?
                // Actually if inverted, "Ground" is top (y=0).
                // So platform should be AT y=0? 
                // Or "floating" slightly down?
                // Standard logic: It's a block on the ground.
                y = 0;
            }
            color = '#FF69B4'; // Hot Pink
        }

        // Platform (rarely add one instead of block? or separate function?)
        // Let's keep it simple for now.

        // Value based on difficulty (reduced from height * 2 to height * 0.5)
        let value = Math.floor(height * 0.5);
        if (value < 1) value = 1; // Minimum 1

        this.obstacles.push({
            x: this.width,
            y: y,
            width: width,
            height: height,
            color: color,
            passed: false,
            hit: false,
            value: value,
            type: type
        });
    }

    spawnPortal(type, color) {
        // Portals appear in the middle of the walkable area?
        let y;
        if (this.gravityScale === 1) {
            y = this.groundY - 80;
        } else {
            y = 80;
        }

        this.obstacles.push({
            x: this.width,
            y: y,
            width: 30,
            height: 60,
            color: color,
            passed: false,
            hit: false,
            type: type // portal_fly, etc.
        });
    }

    checkCollision(rect1, rect2) {
        return (rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y);
    }

    rewardPlayer(amount) {
        // Access global state from main.js if possible, or emit event
        // Ideally we expose a function window.addMoney(amount)
        if (window.addMoney) {
            const actualAmount = window.addMoney(amount);
            this.showFloatingText(`+$${actualAmount}`, this.player.x, this.player.y - 20, '#00ff00');
        }
    }

    hitObstacle() {
        // Visual feedback only
        this.showFloatingText("Miss!", this.player.x, this.player.y - 20, '#ff0000');
        // Maybe visual shake?
    }

    showFloatingText(text, x, y, color) {
        // Simple canvas text or DOM? Canvas is easier since we are in loop
        // We'll just draw it for a few frames? 
        // Better: Use a list of particles/effects
        // For MVP, just console log or rely on UI money update
        console.log(text);
    }

    drawPlayer() {
        const skin = RUNNER_SKINS[this.player.skinIndex] || RUNNER_SKINS[0];
        this.ctx.fillStyle = skin.color;

        const x = this.player.x;
        const y = this.player.y;
        const w = this.player.width;
        const h = this.player.height;
        const cx = x + w / 2; // center x
        const cy = y + h / 2; // center y

        this.ctx.beginPath();

        switch (skin.shape) {
            case 'triangle':
                this.ctx.moveTo(x, y + h);
                this.ctx.lineTo(cx, y);
                this.ctx.lineTo(x + w, y + h);
                break;

            case 'square':
                this.ctx.rect(x, y, w, h);
                break;

            case 'circle':
                this.ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
                break;

            case 'diamond':
                this.ctx.moveTo(cx, y);
                this.ctx.lineTo(x + w, cy);
                this.ctx.lineTo(cx, y + h);
                this.ctx.lineTo(x, cy);
                break;

            case 'star':
                const spikes = 5;
                const outerRadius = w / 2;
                const innerRadius = w / 4;
                for (let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (Math.PI / spikes) * i - Math.PI / 2;
                    const px = cx + Math.cos(angle) * radius;
                    const py = cy + Math.sin(angle) * radius;
                    if (i === 0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                break;

            case 'pentagon':
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                    const px = cx + Math.cos(angle) * (w / 2);
                    const py = cy + Math.sin(angle) * (w / 2);
                    if (i === 0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                break;

            case 'hexagon':
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI * 2 / 6) * i;
                    const px = cx + Math.cos(angle) * (w / 2);
                    const py = cy + Math.sin(angle) * (w / 2);
                    if (i === 0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                break;

            case 'arrow':
                this.ctx.moveTo(x + w, cy);
                this.ctx.lineTo(x + w / 2, y);
                this.ctx.lineTo(x + w / 2, y + h / 3);
                this.ctx.lineTo(x, y + h / 3);
                this.ctx.lineTo(x, y + h * 2 / 3);
                this.ctx.lineTo(x + w / 2, y + h * 2 / 3);
                this.ctx.lineTo(x + w / 2, y + h);
                break;

            default:
                this.ctx.moveTo(x, y + h);
                this.ctx.lineTo(cx, y);
                this.ctx.lineTo(x + w, y + h);
        }

        this.ctx.closePath();
        this.ctx.fill();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Ground
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(0, this.groundY, this.width, 50);

        // Player (using skin system)
        this.drawPlayer();

        // Obstacles
        // Obstacles
        this.obstacles.forEach(obs => {
            if (obs.hit) this.ctx.fillStyle = '#555'; // Greyed out if hit
            else this.ctx.fillStyle = obs.color;

            if (obs.type && obs.type.includes('portal')) {
                // Draw Portal as Ellipse
                this.ctx.beginPath();
                const cx = obs.x + obs.width / 2;
                const cy = obs.y + obs.height / 2;
                const rx = obs.width / 2;
                const ry = obs.height / 2;

                this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // Optional: Add a subtle glow or ring for portals
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else {
                // Normal Rectangular Obstacles
                this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            }
        });

    }

    gameLoop() {
        if (this.isPaused) return;

        this.update();
        this.draw();

        requestAnimationFrame(() => this.gameLoop());
    }
}

// Global Instance
window.runnerGame = new RunnerGame();

// Skins UI Management
let skinsBtn, skinsModal, closeSkinsBtn, skinsGrid;
let runnerShopBtn, runnerShopModal, closeRunnerShopBtn, runnerShopItems;

// Make initialization function global
window.initializeRunnerUI = function () {
    console.log('Initializing Runner UI...');

    // Get all UI elements
    skinsBtn = document.getElementById('skins-btn');
    skinsModal = document.getElementById('skins-modal');
    closeSkinsBtn = document.getElementById('close-skins-btn');
    skinsGrid = document.getElementById('skins-grid');

    runnerShopBtn = document.getElementById('runner-shop-btn');
    runnerShopModal = document.getElementById('runner-shop-modal');
    closeRunnerShopBtn = document.getElementById('close-runner-shop-btn');
    runnerShopItems = document.getElementById('runner-shop-items');

    console.log('Skins button:', skinsBtn);
    console.log('Shop button:', runnerShopBtn);

    // Attach event listeners for skins
    if (skinsBtn) {
        console.log('Attaching click listener to skins button');
        skinsBtn.addEventListener('click', window.openSkinsModal);
    }
    if (closeSkinsBtn) closeSkinsBtn.addEventListener('click', window.closeSkinsModal);

    // Close modal when clicking outside
    if (skinsModal) {
        skinsModal.addEventListener('click', (e) => {
            if (e.target === skinsModal) {
                window.closeSkinsModal();
            }
        });
    }

    // Attach event listeners for runner shop
    if (runnerShopBtn) {
        console.log('Attaching click listener to shop button');
        runnerShopBtn.addEventListener('click', window.openRunnerShopModal);
    }
    if (closeRunnerShopBtn) closeRunnerShopBtn.addEventListener('click', window.closeRunnerShopModal);

    // Close modal when clicking outside
    if (runnerShopModal) {
        runnerShopModal.addEventListener('click', (e) => {
            if (e.target === runnerShopModal) {
                window.closeRunnerShopModal();
            }
        });
    }
}

window.openSkinsModal = function () {
    if (!window.state || !window.state.runnerSkins) return;

    // Pause the runner game
    if (window.runnerGame && window.runnerGame.isActive) {
        window.runnerGame.pause();
    }

    skinsModal.classList.remove('hidden');
    renderSkinsGrid();
}

window.closeSkinsModal = function () {
    skinsModal.classList.add('hidden');

    // Resume the runner game
    if (window.runnerGame && window.runnerGame.isActive) {
        window.runnerGame.resume();
    }
}

function renderSkinsGrid() {
    if (!window.state || !window.state.runnerSkins) return;

    skinsGrid.innerHTML = '';

    RUNNER_SKINS.forEach((skin, index) => {
        const isUnlocked = window.state.runnerSkins.unlockedSkins.includes(index);
        const isCurrent = window.state.runnerSkins.currentSkin === index;
        const isNext = index === window.state.runnerSkins.unlockedSkins.length;

        const skinCard = document.createElement('div');
        skinCard.className = 'skin-card';
        if (isCurrent) skinCard.classList.add('selected');
        if (!isUnlocked) skinCard.classList.add('locked');

        // Preview canvas
        const preview = document.createElement('canvas');
        preview.width = 60;
        preview.height = 60;
        const pctx = preview.getContext('2d');

        // Draw preview
        pctx.fillStyle = skin.color;
        pctx.beginPath();
        const cx = 30, cy = 30, size = 25;

        switch (skin.shape) {
            case 'triangle':
                pctx.moveTo(cx - size / 2, cy + size / 2);
                pctx.lineTo(cx, cy - size / 2);
                pctx.lineTo(cx + size / 2, cy + size / 2);
                break;
            case 'square':
                pctx.rect(cx - size / 2, cy - size / 2, size, size);
                break;
            case 'circle':
                pctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
                break;
            case 'diamond':
                pctx.moveTo(cx, cy - size / 2);
                pctx.lineTo(cx + size / 2, cy);
                pctx.lineTo(cx, cy + size / 2);
                pctx.lineTo(cx - size / 2, cy);
                break;
            case 'star':
                for (let i = 0; i < 10; i++) {
                    const radius = i % 2 === 0 ? size / 2 : size / 4;
                    const angle = (Math.PI / 5) * i - Math.PI / 2;
                    const px = cx + Math.cos(angle) * radius;
                    const py = cy + Math.sin(angle) * radius;
                    if (i === 0) pctx.moveTo(px, py);
                    else pctx.lineTo(px, py);
                }
                break;
            case 'pentagon':
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                    const px = cx + Math.cos(angle) * (size / 2);
                    const py = cy + Math.sin(angle) * (size / 2);
                    if (i === 0) pctx.moveTo(px, py);
                    else pctx.lineTo(px, py);
                }
                break;
            case 'hexagon':
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI * 2 / 6) * i;
                    const px = cx + Math.cos(angle) * (size / 2);
                    const py = cy + Math.sin(angle) * (size / 2);
                    if (i === 0) pctx.moveTo(px, py);
                    else pctx.lineTo(px, py);
                }
                break;
            case 'arrow':
                pctx.moveTo(cx + size / 2, cy);
                pctx.lineTo(cx, cy - size / 2);
                pctx.lineTo(cx, cy - size / 6);
                pctx.lineTo(cx - size / 2, cy - size / 6);
                pctx.lineTo(cx - size / 2, cy + size / 6);
                pctx.lineTo(cx, cy + size / 6);
                pctx.lineTo(cx, cy + size / 2);
                break;
        }
        pctx.closePath();
        pctx.fill();

        skinCard.appendChild(preview);

        const nameLabel = document.createElement('div');
        nameLabel.className = 'skin-name';
        nameLabel.textContent = skin.name;
        skinCard.appendChild(nameLabel);

        if (isUnlocked) {
            if (isCurrent) {
                const equippedLabel = document.createElement('div');
                equippedLabel.className = 'skin-status';
                equippedLabel.textContent = 'Equipped';
                skinCard.appendChild(equippedLabel);
            } else {
                const selectBtn = document.createElement('button');
                selectBtn.className = 'skin-select-btn';
                selectBtn.textContent = 'Select';
                selectBtn.onclick = () => selectSkin(index);
                skinCard.appendChild(selectBtn);
            }
        } else if (isNext) {
            const costLabel = document.createElement('div');
            costLabel.className = 'skin-cost';
            costLabel.textContent = `$${window.state.runnerSkins.nextSkinCost}`;
            skinCard.appendChild(costLabel);

            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'skin-unlock-btn';
            unlockBtn.textContent = 'Unlock';
            unlockBtn.disabled = window.state.clicks < window.state.runnerSkins.nextSkinCost;
            unlockBtn.onclick = () => unlockSkin(index);
            skinCard.appendChild(unlockBtn);
        } else {
            const lockedLabel = document.createElement('div');
            lockedLabel.className = 'skin-status';
            lockedLabel.textContent = 'Locked';
            skinCard.appendChild(lockedLabel);
        }

        skinsGrid.appendChild(skinCard);
    });
}

function selectSkin(index) {
    if (!window.state || !window.state.runnerSkins) return;
    if (!window.state.runnerSkins.unlockedSkins.includes(index)) return;

    window.state.runnerSkins.currentSkin = index;
    window.runnerGame.player.skinIndex = index;
    renderSkinsGrid();
}

function unlockSkin(index) {
    if (!window.state || !window.state.runnerSkins) return;
    if (window.state.clicks < window.state.runnerSkins.nextSkinCost) return;

    // Deduct cost
    window.state.clicks -= window.state.runnerSkins.nextSkinCost;

    // Unlock skin
    window.state.runnerSkins.unlockedSkins.push(index);
    window.state.runnerSkins.currentSkin = index;
    window.runnerGame.player.skinIndex = index;

    // Double the cost for next skin
    window.state.runnerSkins.nextSkinCost *= 2;

    // Update main UI
    if (window.updateUI) window.updateUI();
    if (window.updateRunnerMoneyDisplay) window.updateRunnerMoneyDisplay();

    // Re-render skins to show updated values
    renderSkinsGrid();
}

// Runner Shop Management
window.openRunnerShopModal = function () {
    if (!window.state || !window.state.runnerShop) return;

    // Pause the runner game
    if (window.runnerGame && window.runnerGame.isActive) {
        window.runnerGame.pause();
    }

    runnerShopModal.classList.remove('hidden');
    renderRunnerShop();
}

window.closeRunnerShopModal = function () {
    runnerShopModal.classList.add('hidden');

    // Resume the runner game
    if (window.runnerGame && window.runnerGame.isActive) {
        window.runnerGame.resume();
    }
}

function renderRunnerShop() {
    if (!window.state || !window.state.runnerShop) return;

    runnerShopItems.innerHTML = '';

    // Money Multiplier Upgrade
    const multiplierItem = document.createElement('div');
    multiplierItem.className = 'runner-shop-item';

    const itemName = document.createElement('div');
    itemName.className = 'runner-shop-item-name';
    itemName.textContent = 'Money Multiplier';
    multiplierItem.appendChild(itemName);

    const itemDesc = document.createElement('div');
    itemDesc.className = 'runner-shop-item-desc';
    itemDesc.textContent = 'Increase money earned from obstacles';
    multiplierItem.appendChild(itemDesc);

    const itemStats = document.createElement('div');
    itemStats.className = 'runner-shop-item-stats';
    itemStats.textContent = `Current: x${window.state.runnerShop.moneyMultiplier.toFixed(1)} (Level ${window.state.runnerShop.multiplierLevel})`;
    multiplierItem.appendChild(itemStats);

    const itemCost = document.createElement('div');
    itemCost.className = 'runner-shop-item-cost';
    itemCost.textContent = `Cost: $${window.state.runnerShop.multiplierCost}`;
    multiplierItem.appendChild(itemCost);

    const buyBtn = document.createElement('button');
    buyBtn.className = 'runner-shop-buy-btn';
    buyBtn.textContent = `Upgrade to x${(window.state.runnerShop.moneyMultiplier + 0.5).toFixed(1)}`;
    buyBtn.disabled = window.state.clicks < window.state.runnerShop.multiplierCost;
    buyBtn.onclick = () => buyMultiplierUpgrade();
    multiplierItem.appendChild(buyBtn);

    runnerShopItems.appendChild(multiplierItem);

    // Small Money Boost
    const smallBoostItem = document.createElement('div');
    smallBoostItem.className = 'runner-shop-item';

    const smallBoostName = document.createElement('div');
    smallBoostName.className = 'runner-shop-item-name';
    smallBoostName.textContent = 'Small Money Boost';
    smallBoostItem.appendChild(smallBoostName);

    const smallBoostDesc = document.createElement('div');
    smallBoostDesc.className = 'runner-shop-item-desc';
    smallBoostDesc.textContent = 'Instantly add +0.5x to money multiplier';
    smallBoostItem.appendChild(smallBoostDesc);

    const smallBoostStats = document.createElement('div');
    smallBoostStats.className = 'runner-shop-item-stats';
    smallBoostStats.textContent = 'Boost: +0.5x';
    smallBoostItem.appendChild(smallBoostStats);

    const smallBoostCost = document.createElement('div');
    smallBoostCost.className = 'runner-shop-item-cost';
    smallBoostCost.textContent = 'Cost: $3000';
    smallBoostItem.appendChild(smallBoostCost);

    const smallBoostBtn = document.createElement('button');
    smallBoostBtn.className = 'runner-shop-buy-btn';
    smallBoostBtn.textContent = 'Buy +0.5x';
    smallBoostBtn.disabled = window.state.clicks < 3000;
    smallBoostBtn.onclick = () => buyBoost(0.5, 3000);
    smallBoostItem.appendChild(smallBoostBtn);

    runnerShopItems.appendChild(smallBoostItem);

    // Medium Money Boost
    const mediumBoostItem = document.createElement('div');
    mediumBoostItem.className = 'runner-shop-item';

    const mediumBoostName = document.createElement('div');
    mediumBoostName.className = 'runner-shop-item-name';
    mediumBoostName.textContent = 'Medium Money Boost';
    mediumBoostItem.appendChild(mediumBoostName);

    const mediumBoostDesc = document.createElement('div');
    mediumBoostDesc.className = 'runner-shop-item-desc';
    mediumBoostDesc.textContent = 'Instantly add +1.0x to money multiplier';
    mediumBoostItem.appendChild(mediumBoostDesc);

    const mediumBoostStats = document.createElement('div');
    mediumBoostStats.className = 'runner-shop-item-stats';
    mediumBoostStats.textContent = 'Boost: +1.0x';
    mediumBoostItem.appendChild(mediumBoostStats);

    const mediumBoostCost = document.createElement('div');
    mediumBoostCost.className = 'runner-shop-item-cost';
    mediumBoostCost.textContent = 'Cost: $8000';
    mediumBoostItem.appendChild(mediumBoostCost);

    const mediumBoostBtn = document.createElement('button');
    mediumBoostBtn.className = 'runner-shop-buy-btn';
    mediumBoostBtn.textContent = 'Buy +1.0x';
    mediumBoostBtn.disabled = window.state.clicks < 8000;
    mediumBoostBtn.onclick = () => buyBoost(1.0, 8000);
    mediumBoostItem.appendChild(mediumBoostBtn);

    runnerShopItems.appendChild(mediumBoostItem);

    // Large Money Boost
    const largeBoostItem = document.createElement('div');
    largeBoostItem.className = 'runner-shop-item';

    const largeBoostName = document.createElement('div');
    largeBoostName.className = 'runner-shop-item-name';
    largeBoostName.textContent = 'Large Money Boost';
    largeBoostItem.appendChild(largeBoostName);

    const largeBoostDesc = document.createElement('div');
    largeBoostDesc.className = 'runner-shop-item-desc';
    largeBoostDesc.textContent = 'Instantly add +2.0x to money multiplier';
    largeBoostItem.appendChild(largeBoostDesc);

    const largeBoostStats = document.createElement('div');
    largeBoostStats.className = 'runner-shop-item-stats';
    largeBoostStats.textContent = 'Boost: +2.0x';
    largeBoostItem.appendChild(largeBoostStats);

    const largeBoostCost = document.createElement('div');
    largeBoostCost.className = 'runner-shop-item-cost';
    largeBoostCost.textContent = 'Cost: $20000';
    largeBoostItem.appendChild(largeBoostCost);

    const largeBoostBtn = document.createElement('button');
    largeBoostBtn.className = 'runner-shop-buy-btn';
    largeBoostBtn.textContent = 'Buy +2.0x';
    largeBoostBtn.disabled = window.state.clicks < 20000;
    largeBoostBtn.onclick = () => buyBoost(2.0, 20000);
    largeBoostItem.appendChild(largeBoostBtn);

    runnerShopItems.appendChild(largeBoostItem);

    // Mega Money Boost
    const megaBoostItem = document.createElement('div');
    megaBoostItem.className = 'runner-shop-item';

    const megaBoostName = document.createElement('div');
    megaBoostName.className = 'runner-shop-item-name';
    megaBoostName.textContent = 'Mega Money Boost';
    megaBoostItem.appendChild(megaBoostName);

    const megaBoostDesc = document.createElement('div');
    megaBoostDesc.className = 'runner-shop-item-desc';
    megaBoostDesc.textContent = 'Instantly add +5.0x to money multiplier';
    megaBoostItem.appendChild(megaBoostDesc);

    const megaBoostStats = document.createElement('div');
    megaBoostStats.className = 'runner-shop-item-stats';
    megaBoostStats.textContent = 'Boost: +5.0x';
    megaBoostItem.appendChild(megaBoostStats);

    const megaBoostCost = document.createElement('div');
    megaBoostCost.className = 'runner-shop-item-cost';
    megaBoostCost.textContent = 'Cost: $50000';
    megaBoostItem.appendChild(megaBoostCost);

    const megaBoostBtn = document.createElement('button');
    megaBoostBtn.className = 'runner-shop-buy-btn';
    megaBoostBtn.textContent = 'Buy +5.0x';
    megaBoostBtn.disabled = window.state.clicks < 50000;
    megaBoostBtn.onclick = () => buyBoost(5.0, 50000);
    megaBoostItem.appendChild(megaBoostBtn);

    runnerShopItems.appendChild(megaBoostItem);
}

function buyMultiplierUpgrade() {
    if (!window.state || !window.state.runnerShop) return;
    if (window.state.clicks < window.state.runnerShop.multiplierCost) return;

    // Deduct cost
    window.state.clicks -= window.state.runnerShop.multiplierCost;

    // Upgrade multiplier
    window.state.runnerShop.moneyMultiplier += 0.5;
    window.state.runnerShop.multiplierLevel++;

    // Increase cost (1.5x each time)
    window.state.runnerShop.multiplierCost = Math.floor(window.state.runnerShop.multiplierCost * 1.5);

    // Update UIs
    if (window.updateUI) window.updateUI();
    if (window.updateRunnerMoneyDisplay) window.updateRunnerMoneyDisplay();

    // Re-render shop to show updated values
    renderRunnerShop();
}

function buyBoost(boostAmount, cost) {
    if (!window.state || !window.state.runnerShop) return;
    if (window.state.clicks < cost) return;

    // Deduct cost
    window.state.clicks -= cost;

    // Add boost to multiplier
    window.state.runnerShop.moneyMultiplier += boostAmount;

    // Update UIs
    if (window.updateUI) window.updateUI();
    if (window.updateRunnerMoneyDisplay) window.updateRunnerMoneyDisplay();

    // Re-render shop to show updated values
    renderRunnerShop();
}

// Call initialization when everything is fully loaded
// Using window.onload to ensure DOM is completely ready
window.addEventListener('load', function () {
    console.log('Window loaded, initializing runner UI...');
    setTimeout(function () {
        if (window.initializeRunnerUI) {
            window.initializeRunnerUI();
        }
    }, 100); // Small delay to ensure everything is ready
});
