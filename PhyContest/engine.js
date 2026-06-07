/**
 * Physics Contest Game Engine (2026 NEO-TEST CORE)
 * Handles standard arithmetic operations (+, -, *, / represented as +, -, ×, ÷),
 * horizontal movement clamping, auto-lane-triggering, score carrying, 
 * and dynamic award tier generation.
 */

class PhysicsContestGame {
  constructor(canvasId, scoreHudId, awardHudId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error("Canvas element not found");
    this.ctx = this.canvas.getContext('2d');
    this.scoreHud = document.getElementById(scoreHudId);
    this.awardHud = document.getElementById(awardHudId);

    // Scaling for high DPI screens
    this.dpr = window.devicePixelRatio || 1;
    this.width = 600;
    this.height = 400;

    // Game states
    this.score = 10; // Initial score (Preliminary score, clamped to integer > 0)
    this.isRunning = false;
    this.lastTime = 0;
    
    // Physics parameters
    this.player = {
      x: this.width / 2,
      y: this.height - 80, // Constant vertical coordinate
      width: 50,
      height: 15,
      targetX: this.width / 2, // for mouse/touch tracking
      vx: 0,                   // velocity for keyboard tracking
      accel: 1800,             // keyboard acceleration pixels/sec^2
      friction: 0.82,          // friction damping coefficient
      maxSpeed: 600,           // max speed pixels/sec
      minX: 0,
      maxX: 0
    };

    this.blocks = [];
    this.particles = [];
    this.awardsConfig = null;

    // Timing
    this.spawnInterval = 2000; // spawn a pair every 2 seconds
    this.spawnTimer = 0;
    this.speedMultiplier = 1.0; // scales up slightly over time

    // Control mode: 'keyboard' or 'pointer'
    this.controlMode = 'keyboard';
    this.keys = { Left: false, Right: false };

    // Load awards config from JSON
    this.loadAwardsConfig();

    // Set up sizing
    this.resize();

    // Event listeners
    this.setupControls();
  }

  async loadAwardsConfig() {
    try {
      const response = await fetch('awards.json');
      if (response.ok) {
        this.awardsConfig = await response.json();
        this.updateScoreHUD();
      }
    } catch (e) {
      console.warn("Failed to load awards.json, using dynamic fallback.", e);
    }
  }

  getAwardName(finals) {
    if (this.awardsConfig) {
      const config = this.awardsConfig.find(item => finals >= item.min && finals <= item.max);
      if (config) return config.name;
    } else {
      // Fallback before awards.json loads
      if (finals === 0) return "铁牌";
      if (finals <= 120) return "铜牌";
      if (finals <= 220) return "银牌";
      if (finals <= 400) return "金牌";
    }

    // Dynamic calculation for higher tiers (400-4000 is "超强金牌", 4000-40000 is "超、超强金牌" etc.)
    const power = Math.floor(Math.log10(finals / 4));
    const numChao = Math.max(1, power - 1);
    let chaoPrefix = "";
    for (let i = 0; i < numChao; i++) {
      chaoPrefix += "超" + (i === numChao - 1 ? "" : "、");
    }
    return chaoPrefix + "强金牌";
  }

  getAwardTier(finals) {
    if (finals === 0) return 0; // 铁牌
    if (finals <= 120) return 1; // 铜牌
    if (finals <= 220) return 2; // 银牌
    if (finals <= 400) return 3; // 金牌
    
    // Dynamic calculation for higher tiers
    const power = Math.floor(Math.log10(finals / 4));
    const numChao = Math.max(1, power - 1);
    return numChao + 3;
  }

  generateSingleOp(tier) {
    // Probability of non-multiplication blocks drops to half for each tier increase
    const pNonMult = 0.8 * Math.pow(0.5, tier);
    const r = Math.random();

    if (r > pNonMult) {
      // Multiplication operator (*)
      const val = Math.random() > 0.5 ? 2 : 3;
      return { op: '*', val: val };
    } else {
      // Non-multiplication operator (+, -, /)
      const r2 = Math.random();
      if (r2 < 0.45) {
        // Addition (+)
        const val = Math.floor(Math.random() * 9) + 1; // +1 to +9
        return { op: '+', val: val };
      } else if (r2 < 0.75) {
        // Subtraction (-)
        const val = Math.floor(Math.random() * 9) + 1; // -1 to -9
        return { op: '-', val: val };
      } else {
        // Division (/)
        const val = Math.random() > 0.5 ? 2 : 3; // /2 or /3
        return { op: '/', val: val };
      }
    }
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Limit horizontal movement based on page width
    const rangeWidth = Math.min(500, this.width * 0.85);
    this.player.minX = this.width / 2 - rangeWidth / 2;
    this.player.maxX = this.width / 2 + rangeWidth / 2;
    
    // Y position remains constant
    this.player.y = this.height - 80;

    // Clamp player positions
    this.player.x = Math.max(this.player.minX, Math.min(this.player.maxX, this.player.x));
    this.player.targetX = Math.max(this.player.minX, Math.min(this.player.maxX, this.player.targetX));
  }

  setupControls() {
    // Keyboard listeners (Horizontal only)
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.Left = true;
        this.controlMode = 'keyboard';
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.Right = true;
        this.controlMode = 'keyboard';
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.Left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.Right = false;
      }
    });

    // Pointer listeners (Mouse & Touch)
    const handlePointerMove = (clientX) => {
      if (!this.isRunning) return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      // Convert CSS pixel clientX to canvas internal logical coordinate
      const relativeX = (clientX - rect.left) * (this.width / rect.width);
      // Clamp within player horizontal boundary
      this.player.targetX = Math.max(this.player.minX, Math.min(this.player.maxX, relativeX));
      this.controlMode = 'pointer';
    };

    this.canvas.addEventListener('mousemove', (e) => {
      handlePointerMove(e.clientX);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX);
        e.preventDefault(); // prevent scrolling while playing
      }
    }, { passive: false });
  }

  start() {
    this.score = 10;
    this.blocks = [];
    this.particles = [];
    this.isRunning = true;
    this.lastTime = performance.now();
    this.spawnTimer = this.spawnInterval; // spawn first set quickly
    this.player.x = this.width / 2;
    this.player.targetX = this.width / 2;
    this.player.vx = 0;
    this.speedMultiplier = 1.0;

    this.updateScoreHUD();
  }

  stop() {
    this.isRunning = false;
  }

  spawnBlocks() {
    const rangeWidth = this.player.maxX - this.player.minX;
    const blockWidth = rangeWidth / 2;
    const blockHeight = 25;
    
    // Left lane spans from minX to center, Right lane spans from center to maxX
    const leftX = this.player.minX;
    const rightX = this.width / 2;

    const blockSpeed = (this.height * 0.25) * this.speedMultiplier;

    // Create unique row ID and shared trigger state
    const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const rowState = { triggered: false };

    // Get current finals score to determine award tier
    const tempSemis = Math.floor(this.score / 400);
    const finals = Math.floor(tempSemis / 400);
    const tier = this.getAwardTier(finals);

    // Generate operators based on tier probability
    const op1 = this.generateSingleOp(tier);
    const op2 = this.generateSingleOp(tier);

    this.blocks.push({
      rowId: rowId,
      rowState: rowState,
      x: leftX,
      y: -blockHeight,
      width: blockWidth,
      height: blockHeight,
      op: op1.op,
      val: op1.val,
      text: `${op1.op === '*' ? '×' : op1.op === '/' ? '÷' : op1.op}${op1.val}`,
      speed: blockSpeed,
      type: op1.op === '*' || op1.op === '+' ? 'good' : 'bad'
    });

    this.blocks.push({
      rowId: rowId,
      rowState: rowState,
      x: rightX,
      y: -blockHeight,
      width: blockWidth,
      height: blockHeight,
      op: op2.op,
      val: op2.val,
      text: `${op2.op === '*' ? '×' : op2.op === '/' ? '÷' : op2.op}${op2.val}`,
      speed: blockSpeed,
      type: op2.op === '*' || op2.op === '+' ? 'good' : 'bad'
    });
  }

  gameLoop(currentTime) {
    if (!this.isRunning) return;

    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Cap delta time to prevent physics glitches when tab is inactive
    const limitedDt = Math.min(dt, 0.1);

    this.update(limitedDt);
    this.draw();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    // 1. Spawning timer
    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnBlocks();
      this.spawnTimer = 0;

      // Slowly increase speed multiplier to scale difficulty
      this.speedMultiplier = Math.min(2.0, this.speedMultiplier + 0.03);
    }

    // 2. Player 1D Horizontal Physics Update
    if (this.controlMode === 'keyboard') {
      if (this.keys.Left) {
        this.player.vx -= this.player.accel * dt;
      } else if (this.keys.Right) {
        this.player.vx += this.player.accel * dt;
      } else {
        this.player.vx *= this.player.friction;
        if (Math.abs(this.player.vx) < 5) this.player.vx = 0;
      }

      // Clamp X speed
      if (this.player.vx > this.player.maxSpeed) this.player.vx = this.player.maxSpeed;
      if (this.player.vx < -this.player.maxSpeed) this.player.vx = -this.player.maxSpeed;

      this.player.x += this.player.vx * dt;

      // Keep inside bounds
      this.player.x = Math.max(this.player.minX, Math.min(this.player.maxX, this.player.x));

      // Keep pointer target sync
      this.player.targetX = this.player.x;
    } else {
      // Smooth pointer tracking (1D)
      const dx = this.player.targetX - this.player.x;
      this.player.x += dx * 0.25;
      this.player.vx = 0;
    }

    // 3. Update Falling Blocks & Collision Detection
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      b.y += b.speed * dt;

      // Trigger collision when the block center crosses the player's Y coordinate line
      const blockCenterY = b.y + b.height / 2;
      const playerYThreshold = this.player.y + this.player.height / 2;
      if (blockCenterY >= playerYThreshold && !b.rowState.triggered) {
        // Find both blocks of the same row
        const rowBlocks = this.blocks.filter(x => x.rowId === b.rowId);
        if (rowBlocks.length > 0) {
          let hitBlock = null;
          if (this.player.x < this.width / 2) {
            // Player is on the left half, so they hit the left block
            hitBlock = rowBlocks.find(x => x.x < this.width / 2);
          } else {
            // Player is on the right half, so they hit the right block
            hitBlock = rowBlocks.find(x => x.x >= this.width / 2);
          }

          if (hitBlock) {
            this.applyBlockEffect(hitBlock);
            b.rowState.triggered = true; // Mark row as triggered
            this.createParticles(hitBlock.x + hitBlock.width / 2, hitBlock.y + hitBlock.height / 2, hitBlock.type);
          }
        }

        // Both blocks disappear immediately when one is triggered
        this.blocks = this.blocks.filter(x => x.rowId !== b.rowId);
        break; // break loop since array is filtered
      }

      // Remove off-screen blocks (safety fallback)
      if (b.y > this.height) {
        this.blocks.splice(i, 1);
      }
    }

    // 4. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  applyBlockEffect(block) {
    let newScore = this.score;

    switch (block.op) {
      case '+':
        newScore += block.val;
        break;
      case '-':
        newScore -= block.val;
        break;
      case '*':
        newScore *= block.val;
        break;
      case '/':
        // Integer division, rounded
        newScore = Math.round(newScore / block.val);
        break;
    }

    // Clamp score to integer and greater than 0
    newScore = Math.max(1, Math.round(newScore));
    this.score = newScore;
    this.updateScoreHUD();
  }

  createParticles(x, y, type) {
    const count = 12;
    const color = type === 'good' ? '#ffffff' : '#8e8e93';
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 80;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color: color
      });
    }
  }

  updateScoreHUD() {
    const prelims = this.score % 400;
    const tempSemis = Math.floor(this.score / 400);
    const semis = tempSemis % 400;
    const finals = Math.floor(tempSemis / 400);

    if (this.scoreHud) {
      this.scoreHud.innerHTML = `决赛: ${finals} &nbsp;|&nbsp; 复赛: ${semis} &nbsp;|&nbsp; 预赛: ${prelims}`;
    }

    if (this.awardHud) {
      const awardName = this.getAwardName(finals);
      this.awardHud.textContent = `当前奖项: ${awardName}`;
    }
  }

  draw() {
    // Clear Canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Retrieve active theme colors from DOM (safely wrapped)
    const bodyStyle = getComputedStyle(document.body);
    const getStyleVal = (prop, fallback) => {
      const val = bodyStyle.getPropertyValue(prop);
      return val ? val.trim() : fallback;
    };
    const textPrimary = getStyleVal('--text-primary', '#ffffff');
    const textSecondary = getStyleVal('--text-secondary', '#8e8e93');
    const border = getStyleVal('--border', 'rgba(255, 255, 255, 0.08)');

    // Draw Lane Markings (Dashed vertical lines)
    this.ctx.strokeStyle = border;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 12]);
    
    // Left boundary
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.minX, 0);
    this.ctx.lineTo(this.player.minX, this.height);
    this.ctx.stroke();

    // Right boundary
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.maxX, 0);
    this.ctx.lineTo(this.player.maxX, this.height);
    this.ctx.stroke();
    
    // Middle dividing line (between left and right lanes)
    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2, 0);
    this.ctx.lineTo(this.width / 2, this.height);
    this.ctx.stroke();

    // Collision target horizontal line at player.y
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.minX, this.player.y + this.player.height / 2);
    this.ctx.lineTo(this.player.maxX, this.player.y + this.player.height / 2);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]);

    // Draw Particles
    this.particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;

    // Draw Falling Blocks
    this.blocks.forEach(b => {
      // Draw motion blur trail behind the block
      this.ctx.strokeStyle = b.type === 'good' ? textPrimary : textSecondary;
      this.ctx.globalAlpha = 0.12;
      this.ctx.lineWidth = b.width - 12;
      this.ctx.beginPath();
      this.ctx.moveTo(b.x + b.width / 2, b.y);
      this.ctx.lineTo(b.x + b.width / 2, Math.max(0, b.y - 50));
      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;

      // Outline/Border style box
      this.ctx.fillStyle = b.type === 'good' ? textPrimary : textSecondary;
      this.ctx.strokeStyle = textPrimary;
      this.ctx.lineWidth = 1.5;

      // Draw rect
      this.ctx.fillRect(b.x, b.y, b.width, b.height);
      
      // Black background center to show text clearly
      this.ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#121212';
      this.ctx.fillRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);

      // Draw operator text
      this.ctx.fillStyle = b.type === 'good' ? textPrimary : textSecondary;
      this.ctx.font = 'bold 12px var(--font-mono)';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(b.text, b.x + b.width / 2, b.y + b.height / 2 + 1);
    });

    // Draw Player Block
    const pX = this.player.x - this.player.width / 2;
    const pY = this.player.y;
    
    // Draw outer glow or outline
    this.ctx.strokeStyle = textPrimary;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(pX, pY, this.player.width, this.player.height);
    
    // Solid fill
    this.ctx.fillStyle = textPrimary;
    this.ctx.fillRect(pX + 3, pY + 3, this.player.width - 6, this.player.height - 6);
  }
}

// Export engine
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PhysicsContestGame };
} else {
  window.PhysicsContestGame = PhysicsContestGame;
}
