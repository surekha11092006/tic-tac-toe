/* ================================================
   TIC-TAC-TOE — script.js
   Features:
   • 2-Player & vs AI modes
   • AI: Easy (random) / Medium (smart) / Hard (minimax)
   • Win & draw detection with line animation
   • Score tracking
   • Particle background
   • Sound-less but full haptic + visual feedback
   ================================================ */

// ── DOM ───────────────────────────────────────────
const cells        = document.querySelectorAll('.cell');
const boardEl      = document.getElementById('board');
const statusText   = document.getElementById('status-text');
const turnSymbolEl = document.getElementById('turn-symbol');
const turnMsgEl    = document.getElementById('turn-msg');
const scoreXEl     = document.getElementById('score-x-val');
const scoreOEl     = document.getElementById('score-o-val');
const scoreDrawEl  = document.getElementById('score-draws');
const scoreXCard   = document.getElementById('score-x');
const scoreOCard   = document.getElementById('score-o');
const nameXEl      = document.getElementById('name-x');
const nameOEl      = document.getElementById('name-o');
const resultOverlay= document.getElementById('result-overlay');
const resultTitle  = document.getElementById('result-title');
const resultEmoji  = document.getElementById('result-emoji');
const resultSub    = document.getElementById('result-sub');
const playAgainBtn = document.getElementById('play-again-btn');
const newGameBtn   = document.getElementById('btn-new-game');
const resetScoresBtn=document.getElementById('btn-reset-scores');
const modeBtns     = document.querySelectorAll('.mode-btn');
const diffSelector = document.getElementById('diff-selector');
const diffBtns     = document.querySelectorAll('.diff-btn');
const winLineEl    = document.getElementById('win-line');

// ── Game State ────────────────────────────────────
let board      = Array(9).fill(null); // null | 'X' | 'O'
let current    = 'X';                 // current player
let gameOver   = false;
let mode       = '2p';                // '2p' | 'ai'
let difficulty = 'hard';              // 'easy' | 'medium' | 'hard'
let aiTurnTimer= null;

const scores = { X: 0, O: 0, draws: 0 };

// ── Win combos ────────────────────────────────────
const WIN_COMBOS = [
  [0,1,2], [3,4,5], [6,7,8], // rows
  [0,3,6], [1,4,7], [2,5,8], // cols
  [0,4,8], [2,4,6],          // diags
];

// ── Win line coordinates [x1%,y1%,x2%,y2%] ──────
// Board is 300×300 viewBox. Cells at col/row centres:
// col centres: ~17%, 50%, 83%  → 50, 150, 250 px
// row centres: ~17%, 50%, 83%  → 50, 150, 250 px
const CELL_CENTRES = [
  [50,50],[150,50],[250,50],
  [50,150],[150,150],[250,150],
  [50,250],[150,250],[250,250],
];

// ── Particles ─────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx    = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticles() {
    const count = Math.floor((W * H) / 18000);
    particles = Array.from({ length: count }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,160,255,${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); createParticles(); });
  resize(); createParticles(); draw();
})();

// ── Mode & Difficulty ─────────────────────────────
modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    modeBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    diffSelector.style.display = mode === 'ai' ? 'flex' : 'none';
    updateNames();
    resetGame();
  });
});

diffBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    diffBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
    resetGame();
  });
});

function updateNames() {
  nameXEl.textContent = 'Player X';
  nameOEl.textContent = mode === 'ai' ? '🤖 AI' : 'Player O';
}

// ── Cell click ────────────────────────────────────
cells.forEach((cell) => {
  cell.addEventListener('click', () => {
    const idx = parseInt(cell.dataset.idx, 10);
    if (gameOver || board[idx]) return;
    if (mode === 'ai' && current === 'O') return; // block during AI turn

    makeMove(idx, current);

    if (!gameOver && mode === 'ai' && current === 'O') {
      triggerAIMove();
    }
  });
});

// ── Make a move ───────────────────────────────────
function makeMove(idx, player) {
  board[idx] = player;
  renderCell(idx, player);

  const result = checkResult();
  if (result) {
    handleResult(result);
  } else {
    current = current === 'X' ? 'O' : 'X';
    updateStatus();
    updateActiveCard();
  }
}

function renderCell(idx, player) {
  const cell = cells[idx];
  cell.dataset.sym = player;
  cell.classList.add(player === 'X' ? 'x-mark' : 'o-mark', 'taken');
  cell.setAttribute('aria-label', `${player} at position ${idx + 1}`);
  cell.disabled = true;

  // Ripple
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  cell.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Check result ──────────────────────────────────
function checkResult() {
  for (const combo of WIN_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { type: 'win', player: board[a], combo };
    }
  }
  if (board.every(Boolean)) return { type: 'draw' };
  return null;
}

// ── Handle result ─────────────────────────────────
function handleResult(result) {
  gameOver = true;

  if (result.type === 'win') {
    // Highlight winning cells
    result.combo.forEach((idx) => {
      cells[idx].classList.add('winner');
    });
    // Animate win line
    drawWinLine(result.combo);

    scores[result.player]++;
    updateScoreDisplay(result.player);

    const isAI = mode === 'ai' && result.player === 'O';
    const name = result.player === 'X' ? 'Player X' : (isAI ? 'AI' : 'Player O');
    showResult(
      result.player === 'X' ? 'x-win' : 'o-win',
      `${name} Wins! ${result.player === 'X' ? '🎉' : (isAI ? '🤖' : '🏆')}`,
      result.player === 'X' ? '🎉' : (isAI ? '🤖' : '🏆'),
      isAI ? 'The machine wins this round!' : 'Excellent play!'
    );

    // Update status
    turnSymbolEl.textContent = result.player;
    turnSymbolEl.className = `turn-symbol ${result.player.toLowerCase()}`;
    turnMsgEl.textContent = ' wins!';

  } else {
    scores.draws++;
    scoreDrawEl.textContent = scores.draws;
    showResult('draw', "It's a Draw! 🤝", '🤝', 'Nobody wins this time.');
    turnSymbolEl.textContent = '';
    turnMsgEl.textContent = "It's a draw!";
  }
}

// ── Win line drawing ──────────────────────────────
function drawWinLine(combo) {
  const [a, , c] = combo;
  const [x1, y1] = CELL_CENTRES[a];
  const [x2, y2] = CELL_CENTRES[c];

  winLineEl.setAttribute('x1', x1);
  winLineEl.setAttribute('y1', y1);
  winLineEl.setAttribute('x2', x2);
  winLineEl.setAttribute('y2', y2);

  // Calc dash length
  const dx   = x2 - x1, dy = y2 - y1;
  const len  = Math.sqrt(dx*dx + dy*dy);
  winLineEl.style.strokeDasharray = len;
  winLineEl.style.strokeDashoffset = len;

  // Trigger transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      winLineEl.classList.add('drawn');
    });
  });
}

// ── Result overlay ────────────────────────────────
function showResult(cls, title, emoji, sub) {
  resultTitle.textContent = title;
  resultTitle.className   = `result-title ${cls}`;
  resultEmoji.textContent = emoji;
  resultSub.textContent   = sub;

  setTimeout(() => resultOverlay.classList.add('show'), 400);
}

playAgainBtn.addEventListener('click', () => {
  resultOverlay.classList.remove('show');
  resetGame();
});

// ── Status update ─────────────────────────────────
function updateStatus() {
  const isAIturn = mode === 'ai' && current === 'O';
  turnSymbolEl.textContent = current;
  turnSymbolEl.className   = `turn-symbol ${current.toLowerCase()}`;
  turnMsgEl.textContent    = isAIturn ? ' is thinking…' : "'s turn";
}

function updateActiveCard() {
  scoreXCard.classList.toggle('active', current === 'X');
  scoreOCard.classList.toggle('active', current === 'O');
}

function updateScoreDisplay(player) {
  if (player === 'X') {
    scoreXEl.textContent = scores.X;
    scoreXEl.classList.remove('bump');
    void scoreXEl.offsetWidth;
    scoreXEl.classList.add('bump');
  } else {
    scoreOEl.textContent = scores.O;
    scoreOEl.classList.remove('bump');
    void scoreOEl.offsetWidth;
    scoreOEl.classList.add('bump');
  }
}

// ── Reset game (keep scores) ──────────────────────
function resetGame() {
  clearTimeout(aiTurnTimer);
  board    = Array(9).fill(null);
  current  = 'X';
  gameOver = false;

  cells.forEach((cell) => {
    cell.className = 'cell';
    cell.dataset.sym = '';
    cell.disabled = false;
    cell.setAttribute('aria-label', `Empty cell ${parseInt(cell.dataset.idx) + 1}`);
  });

  winLineEl.classList.remove('drawn');
  winLineEl.setAttribute('x1', 0); winLineEl.setAttribute('y1', 0);
  winLineEl.setAttribute('x2', 0); winLineEl.setAttribute('y2', 0);

  updateStatus();
  updateActiveCard();
  updateNames();
}

newGameBtn.addEventListener('click', () => {
  resultOverlay.classList.remove('show');
  resetGame();
});

resetScoresBtn.addEventListener('click', () => {
  scores.X = 0; scores.O = 0; scores.draws = 0;
  scoreXEl.textContent    = 0;
  scoreOEl.textContent    = 0;
  scoreDrawEl.textContent = 0;
  resetGame();
});

// ── AI ────────────────────────────────────────────
function triggerAIMove() {
  const delay = 350 + Math.random() * 300; // human-feel delay
  aiTurnTimer = setTimeout(() => {
    if (gameOver) return;
    const idx = getBestMove(board, difficulty);
    if (idx !== null && idx !== undefined) {
      makeMove(idx, 'O');
    }
  }, delay);
}

function getBestMove(b, diff) {
  const empty = b.reduce((acc, v, i) => v === null ? [...acc, i] : acc, []);
  if (!empty.length) return null;

  if (diff === 'easy') {
    // Pure random
    return empty[Math.floor(Math.random() * empty.length)];
  }

  if (diff === 'medium') {
    // 60% smart, 40% random
    if (Math.random() < 0.4) {
      return empty[Math.floor(Math.random() * empty.length)];
    }
    // Check for immediate win or block
    const win   = findImmediate(b, 'O');
    if (win !== null) return win;
    const block = findImmediate(b, 'X');
    if (block !== null) return block;
    // Otherwise random
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // Hard: minimax
  return minimax(b, 'O', -Infinity, Infinity).index;
}

function findImmediate(b, player) {
  for (const [a, bIdx, c] of WIN_COMBOS) {
    const vals = [b[a], b[bIdx], b[c]];
    const playerCount = vals.filter(v => v === player).length;
    const nullCount   = vals.filter(v => v === null).length;
    if (playerCount === 2 && nullCount === 1) {
      return [a, bIdx, c][vals.indexOf(null)];
    }
  }
  return null;
}

function minimax(b, player, alpha, beta) {
  const result = checkBoard(b);
  if (result !== null) {
    return { score: result === 'O' ? 10 : result === 'X' ? -10 : 0 };
  }

  const empty = b.reduce((acc, v, i) => v === null ? [...acc, i] : acc, []);
  let best = player === 'O'
    ? { score: -Infinity, index: empty[0] }
    : { score:  Infinity, index: empty[0] };

  for (const idx of empty) {
    const newBoard = [...b];
    newBoard[idx]  = player;
    const { score } = minimax(newBoard, player === 'O' ? 'X' : 'O', alpha, beta);

    if (player === 'O') {
      if (score > best.score) best = { score, index: idx };
      alpha = Math.max(alpha, score);
    } else {
      if (score < best.score) best = { score, index: idx };
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break; // pruning
  }
  return best;
}

function checkBoard(b) {
  for (const [a, bIdx, c] of WIN_COMBOS) {
    if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return b[a];
  }
  if (b.every(Boolean)) return 'draw';
  return null;
}

// ── Keyboard ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Number keys 1-9 map to cells
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 9) {
    const cell = cells[num - 1];
    if (!cell.disabled && !gameOver) cell.click();
  }
  if (e.code === 'KeyR') newGameBtn.click();
  if (e.code === 'Escape' && resultOverlay.classList.contains('show')) {
    resultOverlay.classList.remove('show');
    resetGame();
  }
});

// ── Init ──────────────────────────────────────────
updateNames();
updateStatus();
scoreXCard.classList.add('active');
