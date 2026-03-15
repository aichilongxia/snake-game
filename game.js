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
  const difficultyEl = document.getElementById('difficulty');
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
  let difficulty;

  const DIFFICULTY = {
    easy: { label: '易', baseTickMs: 140, minTickMs: 80, accelPerScoreMs: 1 },
    normal: { label: '中', baseTickMs: 110, minTickMs: 55, accelPerScoreMs: 2 },
    hard: { label: '难', baseTickMs: 85, minTickMs: 40, accelPerScoreMs: 3 },
  };

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

  function loadDifficulty() {
    try {
      const raw = localStorage.getItem('snake.diff');
      return raw && DIFFICULTY[raw] ? raw : 'normal';
    } catch {
      return 'normal';
    }
  }

  function saveDifficulty(value) {
    try {
      localStorage.setItem('snake.diff', value);
    } catch {
      // ignore
    }
  }

  function applyDifficulty(value, { resyncTick = true } = {}) {
    difficulty = DIFFICULTY[value] ? value : 'normal';
    if (difficultyEl) difficultyEl.value = difficulty;
    saveDifficulty(difficulty);

    if (resyncTick) {
      // Recompute tick based on current score.
      const cfg = DIFFICULTY[difficulty];
      const target = cfg.baseTickMs - Math.min(cfg.baseTickMs - cfg.minTickMs, score * cfg.accelPerScoreMs);
      tickMs = Math.max(cfg.minTickMs, target);
      lastTickAt = performance.now();
    }
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

    const cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    tickMs = cfg.baseTickMs;
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
    const cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const target = cfg.baseTickMs - Math.min(cfg.baseTickMs - cfg.minTickMs, score * cfg.accelPerScoreMs);
    tickMs = Math.max(cfg.minTickMs, target);
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
    const snakeColor = styles.getPropertyValue('--snake-color').trim() || fg;
    const foodColor = styles.getPropertyValue('--food-color').trim() || '#ef4444';

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
    ctx.fillStyle = foodColor;
    {
      const x0 = ox + food.x * cs + 3;
      const y0 = oy + food.y * cs + 4;
      const w = cs - 6;
      const h = cs - 8;
      const x = x0;
      const y = y0;
      const topCurveHeight = h * 0.35;

      // Heart path
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h);
      ctx.bezierCurveTo(x + w / 2 + w * 0.55, y + h * 0.75, x + w, y + topCurveHeight, x + w / 2, y + topCurveHeight);
      ctx.bezierCurveTo(x, y + topCurveHeight, x + w / 2 - w * 0.55, y + h * 0.75, x + w / 2, y + h);
      ctx.closePath();
      ctx.fill();
    }

    // Snake
    ctx.fillStyle = snakeColor;
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

  // Persist difficulty choice
  (function initDifficulty() {
    applyDifficulty(loadDifficulty(), { resyncTick: false });
    if (!difficultyEl) return;
    difficultyEl.addEventListener('change', () => {
      applyDifficulty(difficultyEl.value);
    });
  })();

  // Init
  best = loadBest();
  bestEl.textContent = String(best);
  // ensure difficulty has a value if initDifficulty didn't run for any reason
  if (!difficulty) applyDifficulty(loadDifficulty(), { resyncTick: false });
  resetGame();
  requestAnimationFrame(frame);
})();
