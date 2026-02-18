// Game Constants
const MAX_SCALE = 1.2;
const GROWTH_PER_CLICK = 0.05;

// ... (Rest of file preserved until function) ...

// Animal Roster
// Animal Roster
const ANIMALS = [
    'seal.png',
    'axolotl.png',
    'penguin.png',
    'turtle.png',
    'dolphin.png',
    'jellyfish.png',
    'octopus.png',
    'crab.png',
    'whale.png',
    'seahorse.png',
    'starfish.png',
    'clownfish.png',
    'shark.png'
];

// Background Colors matching Animals
const ANIMAL_COLORS = [
    '#87CEEB', // Seal: Sky Blue
    '#FFB6C1', // Axolotl: Pink
    '#E0FFFF', // Penguin: Light Cyan (Ice)
    '#98FB98', // Turtle: Pale Green
    '#00fff7ff', // Dolphin: Deep Sky Blue
    '#DDA0DD', // Jellyfish: Plum
    '#9370DB', // Octopus: Medium Purple
    '#FF4500', // Crab: Orange Red
    '#00008B', // Whale: Dark Blue
    '#FFD700', // Seahorse: Gold
    '#FF69B4', // Starfish: Hot Pink
    '#FF8C00', // Clownfish: Dark Orange
    '#708090'  // Shark: Slate Gray
];

// State
let state = {
    clicks: 0, // This is now "Money"
    currentScale: 1.0,
    animalIndex: 0,
    hasAscended: false,
    targetClicks: 50,
    currentInterval: 50,
    clickPower: 1,
    totalTaps: 0,

    // Feature States
    autoClickerActive: false,
    autoClickPower: 0, // Passive income per second
    highestStageIndex: 0, // Tracks actual progression separate from current avatar
    plusRewardClaimed: false, // One-time reward for drawing
    minusRewardClaimed: false, // One-time penalty for drawing
    questionRewardClaimed: false, // One-time reward for drawing (?)
    purchaseCounts: {}, // Map of itemID -> count
    firstStageCompleted: false, // Track if we've completed the first stage (to prevent re-unlocking starting animal)

    // Runner Skins System
    runnerSkins: {
        unlockedSkins: [0], // Array of unlocked skin indices (0 = default triangle)
        currentSkin: 0, // Currently selected skin
        nextSkinCost: 10000 // Cost of next skin to unlock
    },

    // Runner Shop System
    runnerShop: {
        moneyMultiplier: 1, // How much money obstacles give
        multiplierLevel: 0, // Current level of multiplier
        multiplierCost: 5000 // Cost to upgrade multiplier
    }
};

// Expose state globally for runner.js
window.state = state;

// Shop Definition
// Shop Definition
let shopItems = [
    {
        id: 'upgrade_power_1',
        name: '+1 Click Strength',
        baseName: 'Click Strength', // For display
        value: 1,
        cost: 100,
        type: 'consumable',
        action: function () {
            state.clickPower += this.value;
            this.cost *= 2;
        }
    },
    {
        id: 'upgrade_power_2',
        name: '+2 Click Strength',
        baseName: 'Click Strength',
        value: 2,
        cost: 200,
        type: 'consumable',
        action: function () {
            state.clickPower += this.value;
            this.cost *= 2;
        }
    },
    {
        id: 'unlock_auto',
        name: 'Unlock Auto Clicker',
        baseName: 'Auto Clicker',
        value: 5, // Base power
        cost: 200,
        type: 'one_time',
        bought: false,
        action: function () {
            state.autoClickerActive = true;
            state.autoClickPower = this.value;
            this.bought = true;
            startAutoClicker();
        }
    },
    {
        id: 'upgrade_auto_5',
        name: '+5 Auto Speed',
        baseName: 'Auto Speed',
        value: 5,
        cost: 300,
        type: 'consumable',
        action: function () {
            state.autoClickPower += this.value;
            this.cost *= 2;
        }
    },
    {
        id: 'upgrade_power_5',
        name: '+5 Click Strength',
        baseName: 'Click Strength',
        value: 5,
        cost: 500,
        type: 'consumable',
        action: function () {
            state.clickPower += this.value;
            this.cost *= 2;
        }
    },
    {
        id: 'upgrade_auto_10',
        name: '+10 Auto Speed',
        baseName: 'Auto Speed',
        value: 10,
        cost: 600,
        type: 'consumable',
        action: function () {
            state.autoClickPower += this.value;
            this.cost *= 2;
        }
    },
    {
        id: 'upgrade_power_10',
        name: '+10 Click Strength',
        baseName: 'Click Strength',
        value: 10,
        cost: 1000,
        type: 'consumable',
        action: function () {
            state.clickPower += this.value;
            this.cost *= 2;
        }
    },
    {
        id: 'upgrade_auto_25',
        name: '+25 Auto Speed',
        baseName: 'Auto Speed',
        value: 25,
        cost: 1500,
        type: 'consumable',
        action: function () {
            state.autoClickPower += this.value;
            this.cost *= 2;
        }
    },
    {
        id: 'upgrade_power_25',
        name: '+25 Click Strength',
        baseName: 'Click Strength',
        value: 25,
        cost: 2500,
        type: 'consumable',
        action: function () {
            state.clickPower += this.value;
            this.cost *= 2;
        }
    }
];

// DOM Elements
const clickTarget = document.getElementById('click-target');
const counterValue = document.getElementById('counter-value');
const ascendedContainer = document.getElementById('ascended-container');
const gameContainer = document.getElementById('game-container');
const shopContainer = document.getElementById('shop-items-container');

// Auto Clicker Interval (1 second)
function startAutoClicker() {
    setInterval(() => {
        state.clicks += state.autoClickPower;
        // Check progression passively?
        // User asked for "starts giving you money".
        // Usually passive clicks help progression too.
        checkProgression();
        updateUI();
    }, 1000);
}

function renderShop() {
    shopContainer.innerHTML = '';

    // Filter Items:
    // 1. Always show 'upgrade_power'
    // 2. Show 'unlock_auto' ONLY if NOT active yet
    // 3. Show 'upgrade_auto' ONLY if active

    const activeItems = shopItems.filter(item => {
        // Unlock Auto Clicker: Show ONLY if not active
        if (item.id === 'unlock_auto') {
            return !state.autoClickerActive;
        }

        // Auto Clicker Upgrades: Show ONLY if active
        // Logic verified: These items spawn only AFTER 'Unlock Auto Clicker' is bought.
        if (item.id.includes('upgrade_auto')) {
            return state.autoClickerActive;
        }

        // All other items (Power upgrades): Always show
        return true;
    });

    // Sort removed! Order is determined by the array definition (Initial Price).

    activeItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'shop-item';

        const btn = document.createElement('button');
        btn.className = 'shop-btn';

        // Calculate count early for button text
        if (!state.purchaseCounts) state.purchaseCounts = {};
        const count = state.purchaseCounts[item.id] || 0;

        btn.textContent = `${item.name} (${count})`; // "Name (5)"

        btn.onclick = () => buyItem(item);

        const priceDiv = document.createElement('div');
        priceDiv.className = 'shop-price';
        priceDiv.textContent = `Cost: ${item.cost}`;

        // Stats Display logic remains (for detail) but simplified
        const totalValue = count * item.value;

        console.log(`Rendering Item ${item.id}: Count=${count}, Value=${item.value}, Total=${totalValue}`);

        const statsDiv = document.createElement('div');
        statsDiv.className = 'shop-stats';
        statsDiv.style.fontSize = '0.8rem';
        statsDiv.style.marginTop = '5px';
        statsDiv.style.color = '#fff'; // Changed to pure white to ensure visibility
        statsDiv.style.fontWeight = 'bold'; // Make it bolder

        // Always show stats
        statsDiv.textContent = `Bought: ${count} (Total: +${totalValue})`;

        itemDiv.appendChild(btn);
        itemDiv.appendChild(priceDiv);
        itemDiv.appendChild(statsDiv); // Add stats
        shopContainer.appendChild(itemDiv);

        item.domElement = btn;
    });
}

function updateUI() {
    counterValue.textContent = state.clicks;

    // Update Shop Buttons state
    shopItems.forEach(item => {
        if (!item.domElement) return; // Not rendered

        if (state.clicks >= item.cost && (!item.bought || item.type !== 'one_time')) {
            item.domElement.style.opacity = '1';
            item.domElement.style.cursor = 'pointer';
            item.domElement.disabled = false;
        } else {
            item.domElement.style.opacity = '0.5';
            item.domElement.style.cursor = 'not-allowed';
            item.domElement.disabled = true;
        }
    });
}

function buyItem(item) {
    if (state.clicks >= item.cost) {
        state.clicks -= item.cost;
        item.action();

        // Ensure map exists (safety)
        if (!state.purchaseCounts) state.purchaseCounts = {};

        // Track Purchase Count
        if (!state.purchaseCounts[item.id]) {
            state.purchaseCounts[item.id] = 0;
        }
        state.purchaseCounts[item.id]++;

        // Re-render because sorting might change (cost doubled)
        renderShop();
        updateUI();
    }
}

function handleClick() {
    // Start music on first interaction if not playing (browsers require gesture)
    if (window.soundManager && !window.soundManager.isPlayingMusic) {
        window.soundManager.toggleMusic(true);
    }

    state.clicks += state.clickPower;
    state.totalTaps++;

    // Movement logic
    const offset = (state.totalTaps % 2 === 0) ? 20 : -20;
    const rotation = (state.totalTaps % 2 === 0) ? 5 : -5;
    clickTarget.style.transform = `translateX(${offset}px) rotate(${rotation}deg) scale(1)`;

    // Logic tracking (optional, kept for compatibility if needed, but not limiting visuals)
    // Growth logic
    if (state.currentScale < MAX_SCALE) {
        state.currentScale += GROWTH_PER_CLICK;
    }

    updateUI();
    checkProgression(); // Check progression in clicker mode
}

function checkProgression() {
    if (state.clicks >= state.targetClicks && !state.hasAscended) {
        // Special case: First time reaching target while at starting stage
        if (!state.firstStageCompleted && state.highestStageIndex === 0) {
            // Mark first stage as completed and update target for next unlock
            state.firstStageCompleted = true;
            state.currentInterval = state.currentInterval * 2;
            state.targetClicks = state.targetClicks + state.currentInterval;
            return; // Don't trigger ascension
        }

        // Always trigger ascension after first stage is completed
        // This allows looping through all animals repeatedly
        triggerAscension();
    }
}

function triggerAscension() {
    state.hasAscended = true; // Prevent multiple triggers

    // Save the CURRENT animal index (the one going to shelf)
    const oldAnimalIndex = state.animalIndex;

    // 1. Remove click listener
    clickTarget.removeEventListener('click', handleClick);

    // 2. Animate the OLD animal to the shelf
    const currentRect = clickTarget.getBoundingClientRect();

    // Clone the CURRENT (old) animal for animation
    const clone = clickTarget.cloneNode(true);
    document.body.appendChild(clone);

    // Set clone to absolute positioning matching the current element
    clone.style.position = 'absolute';
    clone.style.left = currentRect.left + 'px';
    clone.style.top = currentRect.top + 'px';
    clone.style.width = currentRect.width + 'px';
    clone.style.height = currentRect.height + 'px';

    clone.style.transform = `scale(1)`; // Start at normal size
    clone.style.transition = 'all 1.0s ease-in-out'; // Smoother
    clone.style.zIndex = 100;

    // Hide original
    clickTarget.style.opacity = '0';
    clickTarget.style.pointerEvents = 'none';

    // Force reflow
    clone.offsetHeight;

    // Move to shelf position
    clone.style.top = '10px';
    clone.style.left = '10px';

    clone.style.width = '40px';
    clone.style.height = '40px';
    clone.style.transform = 'scale(1) rotate(0deg)';

    // After animation, add OLD animal to shelf and spawn NEW animal in center
    setTimeout(() => {
        clone.remove();
        // Add the OLD animal to the shelf
        addAscendedIcon(oldAnimalIndex);
        // Spawn the NEW animal in center
        spawnNextStage();
    }, 1000);
}

function addAscendedIcon(animalIndex, silent = false) {
    // Check if this animal is already on the shelf
    const existingIcons = ascendedContainer.querySelectorAll('.ascended-icon');
    for (let icon of existingIcons) {
        if (parseInt(icon.dataset.index) === animalIndex) {
            return; // Already exists, don't add duplicate
        }
    }

    const wrapper = document.createElement('div');
    wrapper.className = silent ? 'ascended-wrapper' : 'ascended-wrapper pop-in';

    const icon = document.createElement('img');
    icon.src = ANIMALS[animalIndex];
    icon.className = 'ascended-icon';
    icon.dataset.index = animalIndex; // Store index for swapping
    icon.style.cursor = 'pointer'; // Make it look clickable
    icon.onclick = (e) => swapAnimals(e.target);

    wrapper.appendChild(icon);
    ascendedContainer.appendChild(wrapper);
}

function swapAnimals(clickedIcon) {
    const clickedIndex = parseInt(clickedIcon.dataset.index);
    const currentCenterIndex = state.animalIndex;

    // Swap Visuals on Icon
    clickedIcon.src = ANIMALS[currentCenterIndex];
    clickedIcon.dataset.index = currentCenterIndex;

    // Swap Center Animal
    state.animalIndex = clickedIndex;
    clickTarget.src = ANIMALS[clickedIndex];
    gameContainer.style.backgroundColor = ANIMAL_COLORS[clickedIndex];

    // Optional: Add a little pop effect to center to show it changed
    clickTarget.style.transition = 'none';
    clickTarget.style.transform = 'scale(0.8)';
    setTimeout(() => {
        clickTarget.style.transition = 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        clickTarget.style.transform = 'scale(1)';
    }, 50);
}

function spawnNextStage() {
    // Increment progression, loop back if needed
    state.highestStageIndex = (state.highestStageIndex + 1) % ANIMALS.length;
    state.animalIndex = state.highestStageIndex; // Set avatar to the new stage

    state.currentScale = 1.0;
    state.hasAscended = false;

    // Update progression targets
    state.currentInterval = state.currentInterval * 2;
    state.targetClicks = state.targetClicks + state.currentInterval;

    // Reset main target
    clickTarget.src = ANIMALS[state.animalIndex];
    clickTarget.style.opacity = '0'; // Start invisible
    clickTarget.style.transform = 'scale(0)'; // Start small
    clickTarget.style.pointerEvents = 'auto'; // Re-enable clicks

    // Change background color
    gameContainer.style.backgroundColor = ANIMAL_COLORS[state.animalIndex];

    // Animate in
    setTimeout(() => {
        clickTarget.style.transition = 'all 0.5s ease-out';
        clickTarget.style.opacity = '1';
        clickTarget.style.transform = 'scale(1)';

        // Re-attach listener
        setTimeout(() => {
            clickTarget.addEventListener('click', handleClick);
            // Reset transition for click effects
            clickTarget.style.transition = 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        }, 500);
    }, 100);
}

// Initialization
// Ensure starting image and color is correct
clickTarget.src = ANIMALS[state.animalIndex];
gameContainer.style.backgroundColor = ANIMAL_COLORS[state.animalIndex];
clickTarget.addEventListener('click', handleClick);

// Don't populate shelf on initial load - animals will appear only after ascending
// (This makes the game start with an empty collection area)

// Initial Shop Render
renderShop();
updateUI();


// --- Magic Drawing Feature ---

const drawCanvas = document.getElementById('draw-canvas');
const drawCtx = drawCanvas.getContext('2d');
const drawBtn = document.getElementById('draw-toggle-btn');

let isDrawingMode = false;
let isDrawing = false;
let currentStroke = [];
let strokes = []; // Array of {points: [{x,y}], minX, maxX, minY, maxY}
let minusTimeout = null;

// Resize canvas
function resizeCanvas() {
    // Set buffer size to match the visible CSS size exactly
    // This prevents coordinate mismatch (scaling)
    drawCanvas.width = drawCanvas.clientWidth;
    drawCanvas.height = drawCanvas.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
// Call this after a slight delay to ensure layout is done? 
// Or just immediately.
resizeCanvas();

drawBtn.addEventListener('click', toggleDrawingMode);

function toggleDrawingMode() {
    isDrawingMode = !isDrawingMode;
    console.log('Drawing Mode Toggled:', isDrawingMode);

    if (isDrawingMode) {
        drawBtn.classList.add('active');
        drawCanvas.style.pointerEvents = 'auto'; // Capture clicks
        drawCanvas.style.background = 'rgba(0, 0, 0, 0.2)'; // Dim bg slightly
        console.log('Canvas Pointer Events: AUTO');
    } else {
        drawBtn.classList.remove('active');
        drawCanvas.style.pointerEvents = 'none';
        drawCanvas.style.background = 'transparent';
        clearCanvas();
        console.log('Canvas Pointer Events: NONE');
    }
}

function clearCanvas() {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    strokes = [];
    if (minusTimeout) {
        clearTimeout(minusTimeout);
        minusTimeout = null;
    }
}

// Draw Events
drawCanvas.addEventListener('mousedown', startStroke);
drawCanvas.addEventListener('mousemove', moveStroke);
drawCanvas.addEventListener('mouseup', endStroke);

drawCanvas.addEventListener('touchstart', (e) => startStroke(e.touches[0]));
drawCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    moveStroke(e.touches[0]);
});
drawCanvas.addEventListener('touchend', endStroke);

function startStroke(e) {
    if (!isDrawingMode) return;

    // Using simple heuristic: If starting a new stroke, any pending "Minus" check is invalid (since Minus is 1 stroke)
    if (minusTimeout) {
        clearTimeout(minusTimeout);
        minusTimeout = null;
    }

    isDrawing = true;
    currentStroke = [];

    const pos = getPos(e);
    currentStroke.push(pos);

    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);
    drawCtx.strokeStyle = 'white';
    drawCtx.lineWidth = 10;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
}

function moveStroke(e) {
    if (!isDrawing || !isDrawingMode) return;
    const pos = getPos(e);
    currentStroke.push(pos);

    drawCtx.lineTo(pos.x, pos.y);
    drawCtx.stroke();
}

function endStroke() {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentStroke.length > 2) {
        analyzeStroke(currentStroke);
    }
}

function getPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    return {
        x: (e.clientX || e.pageX) - rect.left,
        y: (e.clientY || e.pageY) - rect.top
    };
}

function analyzeStroke(points) {
    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const width = maxX - minX;
    const height = maxY - minY;

    // Classify
    let type = 'unknown';
    // Must be reasonably long
    if (width > 20 || height > 20) {
        if (width > height * 1.2) type = 'horizontal'; // Relaxed from 1.5
        else if (height > width * 1.2) type = 'vertical'; // Relaxed from 1.5
    }

    strokes.push({ type, minX, maxX, minY, maxY, points });

    checkForPlusSign();
    checkForMinusSign();
    checkForQuestionMark();
}

function checkForQuestionMark() {
    if (strokes.length < 2) return;

    // Check last 2 strokes (Hook + Dot)
    const s1 = strokes[strokes.length - 2]; // Hook
    const s2 = strokes[strokes.length - 1]; // Dot

    // Heuristic 1: The Dot (s2) should be small relative to screen, but generous
    const dotWidth = s2.maxX - s2.minX;
    const dotHeight = s2.maxY - s2.minY;

    console.log('Checking Question Mark:', {
        dotW: dotWidth, dotH: dotHeight,
        hookH: s1.maxY - s1.minY,
        dotY: s2.minY, hookBottom: s1.maxY
    });

    if (dotWidth > 60 || dotHeight > 60) { // Relaxed from 30
        console.log('Fail: Dot too big');
        return;
    }

    // Heuristic 2: The Hook (s1) should be reasonably tall
    const hookHeight = s1.maxY - s1.minY;
    if (hookHeight < 30) { // Relaxed from 40
        console.log('Fail: Hook too small');
        return;
    }

    // Heuristic 3: Position - Dot should be below the Hook (or overlapping bottom)
    // Relaxed overlap allowance
    if (s2.minY < s1.maxY - 40) {
        console.log('Fail: Dot too high');
        return;
    }

    // Heuristic 4: Alignment
    const hookMidX = (s1.minX + s1.maxX) / 2;
    const dotMidX = (s2.minX + s2.maxX) / 2;

    if (Math.abs(dotMidX - hookMidX) > 80) { // Relaxed from 50
        console.log('Fail: Misaligned');
        return;
    }

    triggerQuestionReward();
}

function triggerQuestionReward() {
    if (state.questionRewardClaimed) return;

    // Reward!
    state.clicks += 1000;
    state.questionRewardClaimed = true;
    updateUI();

    // Disable drawing? Or just rely on one-time flag.
    toggleDrawingMode();

    // Visual Feedback
    drawCtx.strokeStyle = '#9370DB'; // Purple
    drawCtx.lineWidth = 15;
    drawCtx.translate(0, 0);
    drawCtx.stroke(); // Color the dot?

    const flash = document.createElement('div');
    flash.textContent = '+$1000!';
    flash.style.position = 'absolute';
    flash.style.left = '50%';
    flash.style.top = '50%';
    flash.style.transform = 'translate(-50%, -50%)';
    flash.style.fontSize = '3rem';
    flash.style.color = '#9370DB'; // Purple
    flash.style.fontWeight = 'bold';
    flash.style.textShadow = '0 0 10px black';
    flash.style.zIndex = '3000';
    flash.className = 'pop-in';

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
        clearCanvas();
    }, 1000);
}

function checkForMinusSign() {
    // Check if we have exactly 1 stroke and it is horizontal
    if (strokes.length === 1 && strokes[0].type === 'horizontal') {
        // Wait a bit to see if user draws another one (making it a Plus)
        minusTimeout = setTimeout(() => {
            triggerMinusPenalty();
        }, 800);
    }
}

function triggerMinusPenalty() {
    if (state.minusRewardClaimed) return;

    // Penalty!
    let deduction = 100;
    if (state.clicks < deduction) {
        deduction = state.clicks; // Take all
        state.clicks = 0;
    } else {
        state.clicks -= deduction;
    }

    state.minusRewardClaimed = true;
    updateUI();

    toggleDrawingMode(); // Turn off

    // Visual Feedback
    drawCtx.strokeStyle = '#ff0000'; // Red
    drawCtx.lineWidth = 15;
    drawCtx.stroke(); // Flash red?

    const flash = document.createElement('div');
    flash.textContent = `-$${deduction}!`;
    flash.style.position = 'absolute';
    flash.style.left = '50%';
    flash.style.top = '50%';
    flash.style.transform = 'translate(-50%, -50%)';
    flash.style.fontSize = '3rem';
    flash.style.color = '#ff0000';
    flash.style.fontWeight = 'bold';
    flash.style.textShadow = '0 0 10px black';
    flash.style.zIndex = '3000';
    flash.className = 'pop-in';

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
        clearCanvas();
    }, 1000);
}

function checkForPlusSign() {
    // Need at least 2 strokes
    if (strokes.length < 2) return;

    // Check last 2 strokes
    const s1 = strokes[strokes.length - 2];
    const s2 = strokes[strokes.length - 1];

    // One vertical, one horizontal?
    const types = [s1.type, s2.type];
    if (!types.includes('vertical') || !types.includes('horizontal')) return;

    const vert = s1.type === 'vertical' ? s1 : s2;
    const horiz = s1.type === 'horizontal' ? s1 : s2;

    // Check Intersection
    // Vertical X should be within Horizontal X range
    // Horizontal Y should be within Vertical Y range

    const vertX = (vert.minX + vert.maxX) / 2; // Midpoint
    const horizY = (horiz.minY + horiz.maxY) / 2; // Midpoint

    const intersectsX = vertX > horiz.minX && vertX < horiz.maxX;
    const intersectsY = horizY > vert.minY && horizY < vert.maxY;

    if (intersectsX && intersectsY) {
        triggerPlusReward();
    }
}

function triggerPlusReward() {
    if (state.plusRewardClaimed) return;

    // Reward!
    state.clicks += 100; // Reduced to $100 as requested
    state.plusRewardClaimed = true;
    updateUI();

    // Disable drawing mode permanently? Or just the reward?
    // User said "Only do plus once". 
    // Let's turn off drawing mode and hide the button to be clear it's done.
    toggleDrawingMode(); // Turn off

    // Visual Feedback
    drawCtx.strokeStyle = '#00ff00'; // Green
    drawCtx.lineWidth = 15;
    drawCtx.stroke(); // Re-stroke last path? 
    // Actually, simple flash

    const flash = document.createElement('div');
    flash.textContent = '+$100!';
    flash.style.position = 'absolute';
    flash.style.left = '50%';
    flash.style.top = '50%';
    flash.style.transform = 'translate(-50%, -50%)';
    flash.style.fontSize = '3rem';
    flash.style.color = '#00ff00';
    flash.style.fontWeight = 'bold';
    flash.style.textShadow = '0 0 10px black';
    flash.style.zIndex = '3000';
    flash.className = 'pop-in'; // Reuse existing animation

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
        clearCanvas(); // Reset after success
    }, 1000);
}

// User Comment about forcing save (can be removed or kept as comment)
// Forcing a re-save of main.js to ensure browser cache sees new file

// --- World Flip Logic ---


const flipBtn = document.getElementById('flip-world-btn');
const returnBtn = document.getElementById('return-btn');
const runnerContainer = document.getElementById('runner-container');
const muteBtn = document.getElementById('mute-btn');

let isRunnerMode = false;

// Global Click Sound
document.addEventListener('click', (e) => {
    // Check if clicking a button (or inside one)
    if (e.target.closest('button')) {
        if (window.soundManager) window.soundManager.playClick();
    }
});

// Mute Logic
if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent clicker trigger if necessary
        if (window.soundManager) {
            const isMuted = window.soundManager.toggleMute();
            muteBtn.textContent = isMuted ? '🔇' : '🔊';
        }
    });

    // Make sure it works inside pointer-events: none containers if needed
    muteBtn.style.pointerEvents = 'auto';
}

flipBtn.addEventListener('click', toggleWorld);
returnBtn.addEventListener('click', toggleWorld);

function toggleWorld() {
    isRunnerMode = !isRunnerMode;

    if (isRunnerMode) {
        document.body.classList.add('flipped');
        runnerContainer.classList.remove('hidden'); // Enable pointer events

        // Pause Clicker Interactions (disable buttons?)
        // Styling handles visibility, but let's be safe

        // Sync skin from state
        if (window.runnerGame && state.runnerSkins) {
            window.runnerGame.player.skinIndex = state.runnerSkins.currentSkin;
        }

        // Update money display
        updateRunnerMoneyDisplay();

        // Sync Collection
        updateRunnerCollection();

        // Start Runner
        if (window.runnerGame) {
            window.runnerGame.start();
            window.runnerGame.resume();
        }

        // Switch Music to Runner Mode
        if (window.soundManager) window.soundManager.setMode('runner');

    } else {
        document.body.classList.remove('flipped');
        runnerContainer.classList.add('hidden'); // Disable pointer events

        // Pause Runner
        if (window.runnerGame) {
            window.runnerGame.pause();
        }

        // Switch Music to Clicker Mode
        if (window.soundManager) window.soundManager.setMode('clicker');

        // Check progression when returning from runner (in case we earned enough while playing)
        checkProgression();
    }
}

// Global Money Helper for Runner
window.addMoney = function (amount) {
    // Apply multiplier from runner shop
    const finalAmount = Math.floor(amount * state.runnerShop.moneyMultiplier);
    state.clicks += finalAmount;
    // visual feedback in runner handled by runner
    updateUI();
    updateRunnerMoneyDisplay();
    // Don't trigger progression/ascension while in runner mode
    // It will be checked when returning to clicker
    return finalAmount; // Return actual amount added for feedback
}

// Global Money Helper for Clicker (called when clicking in clicker mode)
window.addMoneyClicker = function (amount) {
    state.clicks += amount;
    updateUI();
    checkProgression(); // Check progression immediately in clicker mode
}

// Update runner money display
function updateRunnerMoneyDisplay() {
    const runnerMoneyEl = document.getElementById('runner-money');
    if (runnerMoneyEl) {
        runnerMoneyEl.textContent = '$' + state.clicks;
    }
}

function updateRunnerCollection() {
    const runnerCollection = document.getElementById('runner-collection-container');
    const originalCollection = document.getElementById('ascended-container');

    if (!runnerCollection || !originalCollection) return;

    runnerCollection.innerHTML = ''; // Clear

    // Copy each child (icon wrapper)
    Array.from(originalCollection.children).forEach(wrapper => {
        const clone = wrapper.cloneNode(true);
        // Remove 'pop-in' class if present to avoid animation re-triggering
        clone.classList.remove('pop-in');

        // Ensure pointer events are off (no swapping in runner)
        const icon = clone.querySelector('img');
        if (icon) {
            icon.style.cursor = 'default';
            icon.onclick = null; // Remove onclick handler
        }

        runnerCollection.appendChild(clone);
    });

    // Also add the CURRENT active animal from the clicker (since it's not on the main runner screen)
    // This allows the user to see their "full progress" including the current seal they are playing as.
    if (ANIMALS[state.animalIndex]) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ascended-wrapper';

        const icon = document.createElement('img');
        icon.src = ANIMALS[state.animalIndex];
        icon.className = 'ascended-icon';
        icon.style.cursor = 'default';

        wrapper.appendChild(icon);
        runnerCollection.appendChild(wrapper);
    }
}

// Make it globally accessible
window.updateRunnerMoneyDisplay = updateRunnerMoneyDisplay;

// Initial Load - DISABLED FOR "ROGUE-LIKE" SESSION
// The user wants the game to reset every time they refresh (Cmd+R).
/*
if (localStorage.getItem('sealClickerState_v3')) {
    try {
        const saved = JSON.parse(localStorage.getItem('sealClickerState_v3'));
        // Merge saved state
        state = { ...state, ...saved };
        
        // Restore purchase counts
        if (state.purchaseCounts) {
             // Logic to restore counts visually already handled by renderShop
        }
    } catch (e) {
        console.error('Save load failed', e);
    }
}
*/

// Auto Save - DISABLED
/*
setInterval(() => {
    localStorage.setItem('sealClickerState_v3', JSON.stringify(state));
}, 5000);
*/

// --- Error Reporting ---
window.onerror = function (message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.background = 'red';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '10px';
    errorDiv.style.zIndex = '10000';
    errorDiv.textContent = `JS Error: ${message} (Line ${lineno})`;
    document.body.appendChild(errorDiv);
};

// --- Save & Load System - DISABLED ---
// const saveData = { ... }
// localStorage.setItem...

console.log("Persistence disabled for rogue-like mode.");
localStorage.clear();

// Load on startup
// loadGame(); // Disabled

// Runner UI will be initialized by runner.js after it loads
