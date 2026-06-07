/**
 * Physics Contest Game Engine (2026 NEO-TEST CORE)
 * Implements smooth canvas-based rendering, inertia physics for the player block,
 * math block falling mechanics, particle effects, and score computation.
 */

class PhysicsContestGame {
  constructor(canvasId, scoreHudId, telemetryId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error("Canvas element not found");
    this.ctx = this.canvas.getContext('2d');
    this.scoreHud = document.getElementById(scoreHudId);
    this.telemetry = document.getElementById(telemetryId);

    // Scaling for high DPI screens
    this.dpr = window.devicePixelRatio || 1;
    this.width = 600;
    this.height = 400;

    // Game states
    this.score = 10; // Initial score (must be integer and > 0)
    this.isRunning = false;
    this.lastTime = 0;
    
    // Physics parameters
    this.player = {
      x: this.width / 2,
      y: this.height - 40,
      width: 60,
      height: 15,
      targetX: this.width / 2, // for mouse/touch tracking
      vx: 0,                   // velocity for keyboard tracking
      accel: 1500,             // keyboard acceleration pixels/sec^2
      friction: 0.85,          // friction damping coefficient
      maxSpeed: 500            // max speed pixels/sec
    };

    this.blocks = [];
    this.particles = [];
    this.logs = [];

    // Timing
    this.spawnInterval = 2000; // spawn a pair every 2 seconds
    this.spawnTimer = 0;
    this.baseSpeed = 120;      // falling speed pixels/sec
    this.speedMultiplier = 1.0; // scales up slightly over time

    // Control mode: 'keyboard' or 'pointer'
    this.controlMode = 'keyboard';
    this.keys = { Left: false, Right: false };

    // Set up sizing
    this.resize();

    // Event listeners
    this.setupControls();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.scale(this.dpr, this.dpr);

    // Adjust player Y relative to canvas height
    this.player.y = this.height - 50;
    
    // Clamp player position
    const halfW = this.player.width / 2;
    this.player.x = Math.max(halfW, Math.min(this.width - halfW, this.player.x));
    this.player.targetX = Math.max(halfW, Math.min(this.width - halfW, this.player.targetX));
  }

  setupControls() {
    // Keyboard listeners
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
      // Clamp within canvas boundaries
      this.player.targetX = Math.max(this.player.width / 2, Math.min(this.width - this.player.width / 2, relativeX));
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
    this.logs = [];
    this.isRunning = true;
    this.lastTime = performance.now();
    this.spawnTimer = this.spawnInterval; // spawn first set quickly
    this.player.x = this.width / 2;
    this.player.targetX = this.width / 2;
    this.player.vx = 0;
    this.speedMultiplier = 1.0;

    this.updateScoreHUD();
    if (this.telemetry) this.telemetry.innerHTML = '';
    this.logSystemEvent("TEST INITIATED: SCORE SET TO 10");

    // Start loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  stop() {
    this.isRunning = false;
  }

  generateOpPair() {
    // Operations pool
    const goodOps = [
      { op: '+', val: 1 },
      { op: '+', val: 2 },
      { op: '+', val: 5 },
      { op: '+', val: 10 },
      { op: '*', val: 2 },
      { op: '*', val: 3 }
    ];

    const badOps = [
      { op: '-', val: 1 },
      { op: '-', val: 2 },
      { op: '-', val: 5 },
      { op: '-', val: 10 },
      { op: '/', val: 2 },
      { op: '/', val: 3 }
    ];

    // Pick one good and one bad to force a choice
    const goodChoice = goodOps[Math.floor(Math.random() * goodOps.length)];
    const badChoice = badOps[Math.floor(Math.random() * badOps.length)];

    // 50% chance to swap lanes
    if (Math.random() > 0.5) {
      return [goodChoice, badChoice];
    } else {
      return [badChoice, goodChoice];
    }
  }

  spawnBlocks() {
    const ops = this.generateOpPair();
    const blockWidth = 50;
    const blockHeight = 25;
    
    // Left lane (25% of width), Right lane (75% of width)
    const leftX = this.width * 0.25 - blockWidth / 2;
    const rightX = this.width * 0.75 - blockWidth / 2;

    const blockSpeed = (this.height * 0.25) * this.speedMultiplier;

    this.blocks.push({
      x: leftX,
      y: -blockHeight,
      width: blockWidth,
      height: blockHeight,
      op: ops[0].op,
      val: ops[0].val,
      text: `${ops[0].op}${ops[0].val}`,
      speed: blockSpeed,
      type: ops[0].op === '+' || ops[0].op === '*' ? 'good' : 'bad'
    });

    this.blocks.push({
      x: rightX,
      y: -blockHeight,
      width: blockWidth,
      height: blockHeight,
      op: ops[1].op,
      val: ops[1].val,
      text: `${ops[1].op}${ops[1].val}`,
      speed: blockSpeed,
      type: ops[1].op === '+' || ops[1].op === '*' ? 'good' : 'bad'
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

    // 2. Player Physics Update
    if (this.controlMode === 'keyboard') {
      // Accelerate left or right
      if (this.keys.Left) {
        this.player.vx -= this.player.accel * dt;
      } else if (this.keys.Right) {
        this.player.vx += this.player.accel * dt;
      } else {
        // Apply friction when no key is pressed
        this.player.vx *= this.player.friction;
        if (Math.abs(this.player.vx) < 5) this.player.vx = 0;
      }

      // Clamp speed
      if (this.player.vx > this.player.maxSpeed) this.player.vx = this.player.maxSpeed;
      if (this.player.vx < -this.player.maxSpeed) this.player.vx = -this.player.maxSpeed;

      this.player.x += this.player.vx * dt;

      // Keep inside bounds
      const halfW = this.player.width / 2;
      if (this.player.x < halfW) {
        this.player.x = halfW;
        this.player.vx = 0;
      }
      if (this.player.x > this.width - halfW) {
        this.player.x = this.width - halfW;
        this.player.vx = 0;
      }
      // Keep pointer target sync
      this.player.targetX = this.player.x;
    } else {
      // Smooth pointer tracking interpolation
      const dx = this.player.targetX - this.player.x;
      this.player.x += dx * 0.2; // Lerp factor
      this.player.vx = 0; // reset keyboard speed
    }

    // 3. Update Falling Blocks
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      b.y += b.speed * dt;

      // Collision detection with player block
      if (this.checkCollision(this.player, b)) {
        this.applyBlockEffect(b);
        this.createParticles(b.x + b.width / 2, b.y + b.height / 2, b.type);
        this.blocks.splice(i, 1);
        continue;
      }

      // Remove off-screen blocks
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

  checkCollision(player, block) {
    // Player is centered horizontally, block is left-aligned
    const pLeft = player.x - player.width / 2;
    const pRight = player.x + player.width / 2;
    const pTop = player.y;
    const pBottom = player.y + player.height;

    const bLeft = block.x;
    const bRight = block.x + block.width;
    const bTop = block.y;
    const bBottom = block.y + block.height;

    return pRight > bLeft && pLeft < bRight && pBottom > bTop && pTop < bBottom;
  }

  applyBlockEffect(block) {
    const originalScore = this.score;
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

    // Log calculation details to telemetry
    this.logSystemEvent(`COLLISION: [${block.text}] ${originalScore} -> ${this.score}`);
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
    if (this.scoreHud) {
      this.scoreHud.textContent = this.score.toString();
    }
  }

  logSystemEvent(msg) {
    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    this.logs.unshift(`[${timestamp}] ${msg}`);
    
    // Keep last 6 logs
    if (this.logs.length > 6) {
      this.logs.pop();
    }

    if (this.telemetry) {
      this.telemetry.innerHTML = this.logs
        .map(line => `<div class="term-line">${line}</div>`)
        .join('');
    }
  }

  draw() {
    // Clear Canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Retrieve active theme colors from DOM
    const bodyStyle = getComputedStyle(document.body);
    const textPrimary = bodyStyle.getPropertyValue('--text-primary').trim() || '#ffffff';
    const textSecondary = bodyStyle.getPropertyValue('--text-secondary').trim() || '#8e8e93';
    const border = bodyStyle.getPropertyValue('--border').trim() || 'rgba(255, 255, 255, 0.08)';

    // Draw Lane Markings (Dashed vertical lines)
    this.ctx.strokeStyle = border;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 15]);
    
    // Lane 0 line
    this.ctx.beginPath();
    this.ctx.moveTo(this.width * 0.25, 0);
    this.ctx.lineTo(this.width * 0.25, this.height);
    this.ctx.stroke();

    // Lane 1 line
    this.ctx.beginPath();
    this.ctx.moveTo(this.width * 0.75, 0);
    this.ctx.lineTo(this.width * 0.75, this.height);
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

      // Draw rounded/sharp rect
      this.ctx.fillRect(b.x, b.y, b.width, b.height);
      
      // Black background center to show text clearly
      this.ctx.fillStyle = getComputedStyle(document.documentElement).getAttribute('data-theme') === 'light' ? '#ffffff' : '#121212';
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
