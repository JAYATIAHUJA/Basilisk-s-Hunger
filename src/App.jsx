import React, { useEffect, useRef, useState, useCallback } from 'react';
import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext';
import WebGLBackground from './WebGLBackground';

// ─────────────────────────────────────────────────────────────────────────────
// NOVEL TEXT  — a short atmospheric chapter
// ─────────────────────────────────────────────────────────────────────────────
const NOVEL_TEXT = `The chamber was lit by plunging torches that cast long, ominous shadows across the damp stone walls. Salazar Slytherin’s legacy was absolute here—a monument to cunning, ambition, and the pureblood supremacy he so deeply revered. The air was thick and tasted metallic, an ancient tang of magic suspended in the underground chill.

"Speak to me, Slytherin, greatest of the Hogwarts Four," a voice echoed, slipping into the sharp, hollow sibilance of Parseltongue. The hissing syllables scraped against the cavern like two stones grinding together. It was a language not meant for human throats.

From the deepest shadows of the statue’s open mouth, movement began. A massive, coiled weight unspooled itself in the abyssal darkness. The Basilisk. The King of Serpents. Its scales, thick as dragon hide and dark as dried blood, scraped in a dull rhythm against the stone. To look into its unblinking, sickly-yellow eyes was to embrace instant, petrifying death. It was said that the venom of the Basilisk could melt iron, but it was the profound terror it instilled that was its true weapon. The beast had slumbered for centuries, preserving the venom of a dark lord's hatred in its fangs.

She closed her eyes tightly, heart hammering against her ribs like a trapped bird. "Don't look at it," she whispered to herself. The heavy, slithering sound drew closer. A faint, rotting scent washed over the chamber floor. The monstrous serpent hissed, tasting the frightened air, its massive frame sliding effortlessly around the ancient pillars. The beast had awoken, and the Chamber of Secrets was unsealed once more. `.repeat(6);

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const FONT = '400 20px "Lora", serif';
const LINE_HEIGHT = 36;
const CELL = 22;          // grid cell size (snake movement unit)
const TICK_MS = 150;         // slowed down ms per snake move for a better feel
const OBSTACLE_R = 18;          // text avoidance radius

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS RENDERERS
// ─────────────────────────────────────────────────────────────────────────────
function drawSnake(ctx, snake, gameState) {
  if (snake.length < 2) return;

  // Catmull-Rom interpolation for smooth path
  const pt = i => snake[Math.max(0, Math.min(snake.length - 1, i))];

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  }

  const path = [];
  const STEPS = 5;
  for (let i = 0; i < snake.length - 1; i++) {
    const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2);
    for (let s = 0; s < STEPS; s++) {
      path.push(catmull(p0, p1, p2, p3, s / STEPS));
    }
  }
  path.push(pt(snake.length - 1));

  const M = path.length;

  ctx.save();
  // Shadow beneath snake using smooth path
  ctx.beginPath();
  for (let i = 0; i < M; i++) {
    const p = path[i];
    if (i === 0) ctx.moveTo(p.x + CELL / 2, p.y + CELL / 2 + 5);
    else ctx.lineTo(p.x + CELL / 2, p.y + CELL / 2 + 5);
  }
  ctx.strokeStyle = 'rgba(239, 204, 9, 0.18)';
  ctx.lineWidth = CELL * 0.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.filter = 'blur(4px)';
  ctx.stroke();
  ctx.filter = 'none';

  // Body segments with color gradient and taper
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = M - 2; i >= 0; i--) {
    const p = path[i];
    const next = path[i + 1];
    const dist = i / (M - 1);

    const w = i < 5 ?
      (CELL * 0.45 + (i * 0.5)) :
      (CELL * 0.75 * Math.max(0.1, 1 - dist));

    const band = Math.sin(i * 0.4) * 0.5 + 0.5;
    const r = Math.round(30 + 15 * band);
    const g = Math.round(60 + 35 * band);
    const b = Math.round(30 + 15 * band);

    ctx.beginPath();
    ctx.moveTo(p.x + CELL / 2, p.y + CELL / 2);
    ctx.lineTo(next.x + CELL / 2, next.y + CELL / 2);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = w * 2.5;
    ctx.stroke();

    // Tiny scale pattern texture
    if (i % 3 === 0 && dist < 0.9) {
      const angle = Math.atan2(next.y - p.y, next.x - p.x) + Math.PI / 2;
      ctx.save();
      ctx.translate(p.x + CELL / 2, p.y + CELL / 2);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(${r + 10},${g + 20},${b + 10},0.4)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.9, w * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Highlight ridge along spine
  ctx.beginPath();
  for (let i = 0; i < M - 4; i++) {
    const p = path[i];
    if (i === 0) ctx.moveTo(p.x + CELL / 2, p.y + CELL / 2);
    else ctx.lineTo(p.x + CELL / 2, p.y + CELL / 2);
  }
  ctx.strokeStyle = 'rgba(120, 200, 100, 0.3)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Head
  const head = path[0];
  const neck = path[Math.min(3, M - 1)];
  const angle = Math.atan2(head.y - neck.y, head.x - neck.x);

  ctx.translate(head.x + CELL / 2, head.y + CELL / 2);
  ctx.rotate(angle);

  // Head shape
  ctx.fillStyle = '#22441a';
  ctx.beginPath();
  ctx.ellipse(4, 0, CELL * 0.8, CELL * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lower Jaw shadow
  ctx.fillStyle = '#11220a';
  ctx.beginPath();
  ctx.ellipse(3, 0, CELL * 0.5, CELL * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeX = 6;
  ctx.fillStyle = '#ffb300';
  ctx.beginPath();
  ctx.arc(eyeX, -6, 2.5, 0, Math.PI * 2);
  ctx.arc(eyeX, 6, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Slit pupils
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(eyeX + 0.5, -6, 1, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(eyeX + 0.5, 6, 1, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tongue
  if (gameState === 'playing' && Math.floor(Date.now() / 150) % 2 === 0) {
    ctx.strokeStyle = '#d32f2f'; // red tongue
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(24, 0);
    ctx.lineTo(28, -4);
    ctx.moveTo(24, 0);
    ctx.lineTo(28, 4);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFood(ctx, food, time) {
  const cx = food.x + CELL / 2;
  const cy = food.y + CELL / 2;

  const pulse = 1 + Math.sin(time * 0.005) * 0.1;

  // Glow
  ctx.fillStyle = 'rgba(211, 47, 47, 0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy, 14 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Apple body
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2);
  ctx.fill();

  // Stem
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.quadraticCurveTo(cx + 3, cy - 12, cx + 5, cy - 10);
  ctx.stroke();
}

function drawBomb(ctx, bomb, time) {
  const cx = bomb.x + CELL / 2;
  const cy = bomb.y + CELL / 2;

  // Bomb body
  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();

  const age = time - bomb.spawnTime;
  const timeLeft = 15000 - age;

  // Danger red pulse
  const dangerRatio = Math.max(0, (age - 10000) / 5000); // 0 to 1 over last 5 seconds
  if (dangerRatio > 0) {
    const pulse = Math.sin(time / (timeLeft < 3000 ? 50 : 200));
    ctx.fillStyle = `rgba(255, 0, 0, ${(pulse + 1) / 2 * dangerRatio})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 3, 0, Math.PI * 2);
  ctx.fill();

  // Fuse
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9);
  ctx.quadraticCurveTo(cx + 5, cy - 15, cx + 10, cy - 12);
  ctx.stroke();

  // Spark
  let flashRate = 200;
  if (timeLeft < 3000) flashRate = 100;
  if (timeLeft < 1000) flashRate = 50;

  if (Math.floor(time / flashRate) % 2 === 0) {
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.arc(cx + 10, cy - 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const prepRef = useRef(null);
  const textContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const domLinesRef = useRef([]);

  const [gameState, setGameState] = useState('preloader');   // preloader | idle | playing | gameover
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const gsRef = useRef('preloader');
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);

  // Game Entities
  const snakeRef = useRef([]);
  const dirRef = useRef({ x: CELL, y: 0 });
  const nextDirRef = useRef({ x: CELL, y: 0 });
  const foodRef = useRef({ x: -100, y: -100 });
  const bombsRef      = useRef([]);
  const lastTickRef   = useRef(0);

  // Audio References
  const bgmRef      = useRef(null);
  const gameOverRef = useRef(null);

  useEffect(() => {
    bgmRef.current = new Audio('/songs/background.mp3');
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.5;

    gameOverRef.current = new Audio('/songs/game over.mp3');
    gameOverRef.current.volume = 0.8;
  }, []);

  // Keep refs in sync with state
  useEffect(() => { gsRef.current = gameState; }, [gameState]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // ── Bound calculation helpers ──
  const getBounds = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Constrain max width for better readability (like a book page)
    const maxContentW = 1200;
    const contentW = Math.min(w, maxContentW);

    // Calculate borders
    const ox = Math.round((w - contentW) / 2) + Math.round(contentW * 0.05);
    const oy = 110;

    const maxPlayW = contentW - Math.round(contentW * 0.1);
    const maxPlayH = h - oy - 80;

    // Snapped bounds
    const cols = Math.floor(maxPlayW / CELL);
    const rows = Math.floor(maxPlayH / CELL);

    return {
      ox, oy,
      cols, rows,
      maxX: ox + cols * CELL - CELL,
      maxY: oy + rows * CELL - CELL
    };
  }, []);

  const randomPos = useCallback(() => {
    const { ox, oy, cols, rows } = getBounds();
    return {
      x: ox + Math.floor(Math.random() * cols) * CELL,
      y: oy + Math.floor(Math.random() * rows) * CELL,
    };
  }, [getBounds]);

  const startGame = useCallback(() => {
    const { ox, oy } = getBounds();
    const startX = ox + CELL * 5;
    const startY = oy + CELL * 5;

    snakeRef.current = [
      { x: startX, y: startY },
      { x: startX - CELL, y: startY },
      { x: startX - CELL * 2, y: startY },
    ];
    dirRef.current = { x: CELL, y: 0 };
    nextDirRef.current = { x: CELL, y: 0 };
    foodRef.current = randomPos();
    bombsRef.current = []; // reset bombs
    scoreRef.current = 0;

    setScore(0);
    setGameState('playing');
    gsRef.current = 'playing';
    lastTickRef.current = 0;

    if (bgmRef.current) {
        bgmRef.current.currentTime = 0;
        bgmRef.current.play().catch(e => console.warn(e));
    }
  }, [getBounds, randomPos]);

  // ── keyboard ──
  useEffect(() => {
    const onKey = (e) => {
      const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
      if (arrows.includes(e.key)) e.preventDefault();

      if (gsRef.current === 'preloader' || gsRef.current === 'idle' || gsRef.current === 'gameover') {
        if (gsRef.current !== 'preloader' && arrows.includes(e.key)) {
          startGame();
        }
        return;
      }

      const d = dirRef.current;
      if (e.key === 'ArrowRight' && d.x === 0) nextDirRef.current = { x: CELL, y: 0 };
      if (e.key === 'ArrowLeft' && d.x === 0) nextDirRef.current = { x: -CELL, y: 0 };
      if (e.key === 'ArrowUp' && d.y === 0) nextDirRef.current = { x: 0, y: -CELL };
      if (e.key === 'ArrowDown' && d.y === 0) nextDirRef.current = { x: 0, y: CELL };
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startGame]);

  // ── main game + render loop ──
  useEffect(() => {
    const textContainer = textContainerRef.current;
    const canvas = canvasRef.current;
    if (!textContainer || !canvas) return;

    let animId;
    let isAlive = true;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (time) => {
      if (!isAlive || !prepRef.current) return;

      const prep = prepRef.current;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bounds = getBounds();

      // ── UPDATE BOMBS & EXPLOSIONS ──
      if (gsRef.current === 'playing') {
        bombsRef.current.forEach(b => {
          if (b.state === 'ticking' && time - b.spawnTime > 15000) {
            b.state = 'exploding';
            b.explodeStartTime = time;
          }
        });

        let hitExplosion = false;
        bombsRef.current = bombsRef.current.filter(b => {
          if (b.state === 'exploding') {
            const elapsed = time - b.explodeStartTime;
            if (elapsed > 600) return false; // cleanup explosion after 600ms

            // Dynamic explosion radius over time
            let explosionR = 0;
            if (elapsed < 200) explosionR = (elapsed / 200) * 160;
            else if (elapsed < 400) explosionR = 160;
            else explosionR = (1 - ((elapsed - 400) / 200)) * 160;

            b.currentR = explosionR;

            // Check if it engulfs the snake head
            if (snakeRef.current.length > 0) {
              const head = snakeRef.current[0];
              const dx = head.x + CELL / 2 - (b.x + CELL / 2);
              const dy = head.y + CELL / 2 - (b.y + CELL / 2);
              if (Math.sqrt(dx * dx + dy * dy) < explosionR) {
                hitExplosion = true;
              }
            }
          }
          return true;
        });

        if (hitExplosion) {
          const hs = Math.max(highScoreRef.current, scoreRef.current);
          highScoreRef.current = hs;
          setHighScore(hs);
          setGameState('gameover');
          gsRef.current = 'gameover';
          
          if (bgmRef.current) bgmRef.current.pause();
          if (gameOverRef.current) {
              gameOverRef.current.currentTime = 0;
              gameOverRef.current.play().catch(e => console.warn(e));
          }
        }
      }

      // ── TICK SNAKE ──
      if (gsRef.current === 'playing' && time - lastTickRef.current > TICK_MS) {
        lastTickRef.current = time;

        const nd = nextDirRef.current;
        const cd = dirRef.current;
        if (!(cd.x !== 0 && nd.x === -cd.x) && !(cd.y !== 0 && nd.y === -cd.y)) {
          dirRef.current = nd;
        }
        const dir = dirRef.current;

        const snake = snakeRef.current;
        const newHead = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        // Die on wall collision
        const hitWall = newHead.x < bounds.ox || newHead.x > bounds.maxX || newHead.y < bounds.oy || newHead.y > bounds.maxY;

        // Die on self collision
        const hitSelf = snake.slice(1).some(s => s.x === newHead.x && s.y === newHead.y);

        // Die on ticking bomb
        const hitBomb = bombsRef.current.some(b => b.state === 'ticking' && b.x === newHead.x && b.y === newHead.y);

        if (hitWall || hitSelf || hitBomb) {
          const hs = Math.max(highScoreRef.current, scoreRef.current);
          highScoreRef.current = hs;
          setHighScore(hs);
          setGameState('gameover');
          gsRef.current = 'gameover';

          if (bgmRef.current) bgmRef.current.pause();
          if (gameOverRef.current) {
              gameOverRef.current.currentTime = 0;
              gameOverRef.current.play().catch(e => console.warn(e));
          }
        } else {
          snake.unshift(newHead);
          const f = foodRef.current;

          if (newHead.x === f.x && newHead.y === f.y) {
            // Ate Food
            const ns = scoreRef.current + 10;
            scoreRef.current = ns;
            setScore(ns);

            foodRef.current = randomPos();

            // Chance to add a bomb
            if (Math.random() < 0.3) {
              let nb;
              let attempts = 0;
              do {
                nb = randomPos();
                attempts++;
              } while (attempts < 10 && (nb.x === foodRef.current.x && nb.y === foodRef.current.y));
              nb.spawnTime = time;
              nb.state = 'ticking';
              bombsRef.current.push(nb);
            }

          } else {
            snake.pop(); // Standard move
          }
        }
      }

      // ── BUILD OBSTACLE LIST for Text Engine ──
      const obstacles = snakeRef.current.map(s => ({
        cx: s.x + CELL / 2,
        cy: s.y + CELL / 2,
        r: OBSTACLE_R,
      }));
      if (gsRef.current !== 'idle') {
        const f = foodRef.current;
        obstacles.push({ cx: f.x + CELL / 2, cy: f.y + CELL / 2, r: OBSTACLE_R + 6 });
        bombsRef.current.forEach(b => {
          if (b.state === 'ticking') {
            obstacles.push({ cx: b.x + CELL / 2, cy: b.y + CELL / 2, r: OBSTACLE_R + 4 });
          } else if (b.state === 'exploding') {
            obstacles.push({ cx: b.x + CELL / 2, cy: b.y + CELL / 2, r: b.currentR });
          }
        });
      }

      // ── LAYOUT TEXT in 2 columns with ROBUST collision ──
      const colGap = 60;
      const colW = ((bounds.maxX + CELL - bounds.ox) - colGap) / 2;
      const colStarts = [bounds.ox, bounds.ox + colW + colGap];

      let cursor = { segmentIndex: 0, graphemeIndex: 0 };
      let lineIdx = 0;
      let col = 0;
      let y = bounds.oy;

      while (true) {
        const colX = colStarts[col];
        const yc = y + LINE_HEIGHT / 2;

        // Find gaps around obstacles for maximum readability
        let freeSpaces = [{ start: colX, end: colX + colW }];
        for (const obs of obstacles) {
          const dy = Math.abs(yc - obs.cy);
          if (dy < obs.r) {
            // Buffer to keep text comfortably away from characters
            const halfW = obs.r * Math.sqrt(Math.max(0, 1 - (dy * dy) / (obs.r * obs.r))) + 12;
            const obsL = obs.cx - halfW;
            const obsR = obs.cx + halfW;

            let nextSpaces = [];
            for (const space of freeSpaces) {
              if (obsR <= space.start || obsL >= space.end) {
                nextSpaces.push(space); // no interaction
              } else {
                if (space.start < obsL) nextSpaces.push({ start: space.start, end: obsL });
                if (obsR < space.end) nextSpaces.push({ start: obsR, end: space.end });
              }
            }
            freeSpaces = nextSpaces;
          }
        }

        // Only choose the widest available space on this line to render
        let maxSpace = { start: colX, width: 0 };
        for (const space of freeSpaces) {
          const width = space.end - space.start;
          if (width > maxSpace.width) {
            maxSpace = { start: space.start, width };
          }
        }

        // If space is too narrow, leave a blank space for pristine readability!
        if (maxSpace.width >= 40) {
          const line = layoutNextLine(prep, cursor, maxSpace.width);
          if (line === null) break; // EOF

          if (lineIdx >= domLinesRef.current.length) {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.top = '0';
            el.style.left = '0';
            el.style.whiteSpace = 'pre';
            el.style.fontFamily = '"Lora", serif';
            el.style.fontSize = '20px';
            el.style.lineHeight = `${LINE_HEIGHT}px`;
            el.style.color = '#7f9c8f'; // Light teal/grey text for dark background
            el.style.pointerEvents = 'none';
            el.style.willChange = 'transform';
            // Add a subtle text shadow for better reading against smoke
            el.style.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
            textContainer.appendChild(el);
            domLinesRef.current.push(el);
          }

          const el = domLinesRef.current[lineIdx];
          if (el.textContent !== line.text) el.textContent = line.text;
          el.style.transform = `translate3d(${maxSpace.start}px,${y}px,0)`;

          cursor = line.end;
          lineIdx++;
        }

        y += LINE_HEIGHT;

        if (y > bounds.maxY + CELL) {
          if (col === 0) { col = 1; y = bounds.oy; }
          else break;
        }
      }

      // Hide leftover lines
      for (let i = lineIdx; i < domLinesRef.current.length; i++) {
        domLinesRef.current[i].style.transform = 'translate3d(-99999px,0,0)';
      }

      // ── DRAW ENTITIES ──
      // Draw border mapping the death bounds
      ctx.save();
      ctx.strokeStyle = 'rgba(156, 174, 163, 0.15)'; // Faded light teal
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(bounds.ox, bounds.oy, bounds.maxX + CELL - bounds.ox, bounds.maxY + CELL - bounds.oy);
      ctx.restore();

      if (gsRef.current !== 'idle' && snakeRef.current.length > 1) {
        drawSnake(ctx, snakeRef.current, gsRef.current);
      }
      if (gsRef.current !== 'idle') {
        drawFood(ctx, foodRef.current, time);
        for (const b of bombsRef.current) {
          if (b.state === 'ticking') {
            drawBomb(ctx, b, time);
          } else if (b.state === 'exploding') {
            const alpha = Math.max(0, 1 - (time - b.explodeStartTime) / 600);

            ctx.save();
            ctx.filter = 'blur(4px)';
            ctx.fillStyle = `rgba(255, 69, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(b.x + CELL / 2, b.y + CELL / 2, Math.max(0, b.currentR), 0, Math.PI * 2);
            ctx.fill();

            ctx.filter = 'blur(1px)';
            ctx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
            ctx.beginPath();
            ctx.arc(b.x + CELL / 2, b.y + CELL / 2, Math.max(0, b.currentR * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    document.fonts.ready.then(() => {
      if (!isAlive) return;
      prepRef.current = prepareWithSegments(NOVEL_TEXT, FONT, { whiteSpace: 'pre-wrap' });
      animId = requestAnimationFrame(loop);
    });

    return () => {
      isAlive = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [getBounds, randomPos]);

  // ─────────────────────────────────────────────────────────────────────────
  // JSX UI Overlay
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-black text-[#9caea3]">

      {/* ── header ── */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-16 py-6 border-b border-[#9caea3]/10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-baseline gap-3">
          <span className="font-sans text-[13px] text-[#9caea3] opacity-60 tracking-widest uppercase font-semibold">THE CHAMBER</span>
        </div>

        <div className="text-center">
          <h1 className="fruktur-regular text-5xl font-bold tracking-wide leading-none text-[#7f9c8f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            Slumber No More
          </h1>
        </div>

        <div className="flex items-center gap-6 font-serif text-[15px] tracking-wide text-[#9caea3]">
          <span>
            Souls:&nbsp;<strong className="font-bold text-[#b8d6c7]">{score}</strong>
          </span>
          <span className="opacity-60">
            Best:&nbsp;<strong className="text-[#b8d6c7]">{highScore}</strong>
          </span>
        </div>
      </header>

      {/* ── Preloader Overlay (Opaque) ── */}
      <div 
         className={`absolute inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer transition-opacity duration-1000 bg-[#021812] ${gameState === 'preloader' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
         onClick={() => { 
            if(gameState === 'preloader') { 
                setGameState('idle'); 
                gsRef.current = 'idle'; 
                // start bgm immediately
                if (bgmRef.current) {
                    bgmRef.current.play().catch(e => console.warn(e));
                }
            } 
         }}
      >
          <WebGLBackground />
          
          <h1 className="fruktur-regular text-7xl text-[#9caea3] mb-8 relative z-10" style={{ textShadow: '0 0 40px rgba(156,174,163,0.3)' }}>
          The Chamber of Secrets
        </h1>
        <p className="relative z-10 font-serif italic text-2xl max-w-2xl text-center leading-loose text-[#7f9c8f] drop-shadow-lg">
          "The King of Serpents slumbers in the depths.<br />
          Those who possess the cunning of Salazar shall guide the beast."
        </p>
        <p className="relative z-10 mt-20 tracking-[0.4em] text-sm text-[#5d7a6b] uppercase animate-pulse font-bold">
          Click to break the seal
        </p>
      </div>

      {/* ── text container (DOM lines injected here) ── */}
      <div ref={textContainerRef} className="absolute inset-0 z-[4] pointer-events-none" />

      {/* ── canvas (snake + food drawn here) ── */}
      <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none" />

      {/* ── Overlays ── */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-md">
          <div className="text-center max-w-md px-12 py-10 bg-[#061c14]/80 text-[#9caea3] rounded-lg shadow-2xl border border-[#9caea3]/20">
            <h2 className="fruktur-regular text-6xl text-[#7f9c8f] mb-4 leading-none select-none">
              Awaken
            </h2>
            <p className="text-[17px] opacity-80 mb-6 italic" style={{ fontFamily: '"Lora"' }}>
              Survival is simple: Do not cross your own tail, and absolutely do not touch the faded margins of the page.
            </p>
            <p className="text-[14px] text-red-500 mb-8 italic font-semibold" style={{ fontFamily: '"Lora"' }}>
              Beware the black mines scattered through the lore.
            </p>

            <p className="text-[15px] font-semibold tracking-widest uppercase opacity-60">
              Press any Arrow Key
            </p>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-lg transition-all duration-300">
          <div className="text-center max-w-sm px-14 py-12 bg-[#0a0505]/90 rounded-2xl shadow-[0_0_80px_rgba(255,0,0,0.15)] border border-red-900/60 transform scale-100">

            <h2 className="text-5xl font-bold italic mb-2 text-red-500 drop-shadow-md" style={{ fontFamily: '"Playfair Display"' }}>
              Defeated
            </h2>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-red-900/50 to-transparent my-6" />

            <div className="text-2xl mb-1 text-[#e2d6c5]" style={{ fontFamily: '"Lora"' }}>
              Score: <strong>{score}</strong>
            </div>
            <div className="text-sm opacity-50 mb-8 text-[#e2d6c5]" style={{ fontFamily: '"Lora"' }}>
              Best: {highScore}
            </div>

            <p className="text-[13px] tracking-widest uppercase text-red-400 opacity-60 font-semibold">
              Arrow Key to Play Again
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
