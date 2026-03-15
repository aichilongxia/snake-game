(() => {
  'use strict';

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d', { alpha: false });

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlayTitle');
  const overlayTextEl = document.getElementById('overlayText');
  const restartBtn = document.getElementById('restartBtn');
  const wrapToggle = document.getElementById('wrapToggle');
  const pauseBtn = document.getElementById('pauseBtn');

  /**
   * Board sizing
   */
  const GRID = 20;

  function resizeCanvasToDisplaySize() {
    const cssSize = Math.floor(canvas.getBoundingClientRect().width);
    const target = Math.max(240, Math.min(720, cssSize));

    if (canvas.width !== target || canvas.height !== target) {
      canvas.width = target;
      canvas.height = target;
    }
  }

  function cellSize() {
    return Math.floor(canvas.width / GRID);
  }

  /**
   * Game state
   */
  const DIR = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  function isOpposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function keyToDir(key) {
    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        return DIR.up;
      case 'ArrowDown':
      case 's':
      case 'S':
        return DIR.down;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return DIR.left;
      case 'ArrowRight':
      case 'd':
      case 'D':
        return DIR.right;
      default:
        return null;
    }
  }

  function inBounds(p) {
    return p.x >= 0 && p.y >= 0 && p.x < GRID && p.y < GRID;
  }

  function wrapPoint(p) {
    return {
      x: (p.x + GRID) % GRID,
      y: (p.y + GRID) % GRID,
    };
  }

  function pointsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function containsPoint(list, p) {
    for (let i = 0; i < list.length; i++) {
      if (pointsEqual(list[i], p)) return true;
    }
    return false;
  }

  function randomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function randomFood(snake) {
    // Avoid infinite loops; grid is small.
    for (let tries = 0; tries < 5000; tries++) {
      const p = { x: randomInt(GRID), y: randomInt(GRID) };
      if (!containsPoint(snake, p)) return p;
    }
    // Fallback: if grid is full, return origin.
    return { x: 0, y: 0 };
  }

  let snake;
  let dir;
  let nextDir;
  let food;
  let score;
  let best;
  let running;
  let gameOver;
  let tickMs;
  let lastTickAt;

  function loadBest() {
    try {
      const raw = localStorage.getItem('snake.best');
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  function saveBest(n) {
    try {
      localStorage.setItem('snake.best', String(n));
    } catch {
      // ignore
    }
  }

  function setOverlay(visible, title, text) {
    if (!visible) {
      overlayEl.hidden = true;
      return;
    }
    overlayEl.hidden = false;
    overlayTitleEl.textContent = title;
    overlayTextEl.textContent = text;
  }

  function setPauseButtonText() {
    pauseBtn.textContent = running ? '暂停' : '继续';
  }

  function resetGame() {
    const mid = Math.floor(GRID / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid, y: mid },
      { x: mid + 1, y: mid },
    ];
    dir = DIR.right;
    nextDir = DIR.right;
    food = randomFood(snake);
    score = 0;
    running = true;
    gameOver = false;

    tickMs = 110; // base speed
    lastTickAt = performance.now();

    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
    setOverlay(false);
    setPauseButtonText();
  }

  function endGame(reasonText) {
    running = false;
    gameOver = true;
    setPauseButtonText();
    setOverlay(true, '游戏结束', reasonText);
  }

  function maybeSpeedUp() {
    // Slightly speed up as score increases; keep it simple.
    const target = 110 - Math.min(50, score * 2);
    tickMs = Math.max(55, target);
  }

  function step() {
    dir = nextDir;

    const head = snake[snake.length - 1];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    const wrap = wrapToggle.checked;

    let candidate = newHead;
    if (wrap) {
      candidate = wrapPoint(candidate);
    } else if (!inBounds(candidate)) {
      endGame('撞墙了');
      return;
    }

    // Self collision: allow moving into the tail only if it will move away (i.e. not eating).
    const willEat = pointsEqual(candidate, food);
    const bodyToCheck = willEat ? snake : snake.slice(1);
    if (containsPoint(bodyToCheck, candidate)) {
      endGame('撞到自己了');
      return;
    }

    snake.push(candidate);

    if (willEat) {
      score += 1;
      scoreEl.textContent = String(score);
      if (score > best) {
        best = score;
        bestEl.textContent = String(best);
        saveBest(best);
      }
      maybeSpeedUp();
      food = randomFood(snake);
    } else {
      snake.shift();
    }
  }

  function draw() {
    const cs = cellSize();
    const boardPx = cs * GRID;

    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--board-bg').trim() || 'Canvas';
    const fg = styles.getPropertyValue('--board-fg').trim() || 'CanvasText';
    const accent = styles.getPropertyValue('--board-accent').trim() || 'AccentColor';

    // Clear
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center board if canvas is larger due to rounding.
    const ox = Math.floor((canvas.width - boardPx) / 2);
    const oy = Math.floor((canvas.height - boardPx) / 2);

    // Grid (very subtle)
    ctx.save();
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      const x = ox + i * cs + 0.5;
      const y = oy + i * cs + 0.5;
      ctx.beginPath();
      ctx.moveTo(ox + 0.5, y);
      ctx.lineTo(ox + boardPx + 0.5, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, oy + 0.5);
      ctx.lineTo(x, oy + boardPx + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // Food
    ctx.fillStyle = accent;
    ctx.fillRect(ox + food.x * cs + 2, oy + food.y * cs + 2, cs - 4, cs - 4);

    // Snake
    ctx.fillStyle = fg;
    for (let i = 0; i < snake.length; i++) {
      const p = snake[i];
      ctx.fillRect(ox + p.x * cs + 2, oy + p.y * cs + 2, cs - 4, cs - 4);
    }

    // Head highlight
    const head = snake[snake.length - 1];
    ctx.save();
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(ox + head.x * cs + 3, oy + head.y * cs + 3, cs - 6, cs - 6);
    ctx.restore();
  }

  function frame(now) {
    resizeCanvasToDisplaySize();

    if (running && !gameOver) {
      const elapsed = now - lastTickAt;
      if (elapsed >= tickMs) {
        // If a frame is delayed, keep the game from "fast-forwarding" too much.
        lastTickAt = now - (elapsed % tickMs);
        step();
      }
    }

    draw();
    requestAnimationFrame(frame);
  }

  function requestDirection(d) {
    if (!d) return;
    if (gameOver) return;

    // Prevent instant 180-degree turns.
    if (isOpposite(d, dir)) return;

    nextDir = d;
  }

  function togglePause() {
    if (gameOver) return;
    running = !running;
    setPauseButtonText();
    if (running) {
      lastTickAt = performance.now();
    }
  }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.key === 'Enter') {
      if (gameOver) resetGame();
      return;
    }

    const d = keyToDir(e.key);
    if (d) {
      e.preventDefault();
      requestDirection(d);
    }
  }, { passive: false });

  // Touch pad (pointer events)
  function wirePadButton(btn) {
    const dirName = btn.getAttribute('data-dir');
    const d = DIR[dirName];

    const handler = (e) => {
      e.preventDefault();
      requestDirection(d);
      // On mobile, a direction press should also "wake" the game.
      if (!running && !gameOver) {
        running = true;
        setPauseButtonText();
        lastTickAt = performance.now();
      }
    };

    btn.addEventListener('pointerdown', handler, { passive: false });
  }

  document.querySelectorAll('.padBtn').forEach(wirePadButton);

  // Buttons
  restartBtn.addEventListener('click', () => resetGame());
  overlayEl.addEventListener('click', (e) => {
    // Click outside card to restart
    if (e.target === overlayEl && gameOver) resetGame();
  });

  pauseBtn.addEventListener('click', () => togglePause());

  // Persist wrap toggle choice
  (function initWrapToggle() {
    try {
      const raw = localStorage.getItem('snake.wrap');
      wrapToggle.checked = raw === '1';
    } catch {
      // ignore
    }

    wrapToggle.addEventListener('change', () => {
      try {
        localStorage.setItem('snake.wrap', wrapToggle.checked ? '1' : '0');
      } catch {
        // ignore
      }
    });
  })();

  // Init
  best = loadBest();
  bestEl.textContent = String(best);
  resetGame();
  requestAnimationFrame(frame);
})();
