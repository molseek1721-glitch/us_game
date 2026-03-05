const scoreNode = document.getElementById('score');
const passedNode = document.getElementById('passed');
const bestNode = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const arena = document.getElementById('arena');
const runner = document.getElementById('runner');
const hint = document.getElementById('hint');

const GROUND_HEIGHT = 48;
const GRAVITY = 0.84;
const JUMP_FORCE = 14.8;
const BASE_SPEED = 5.5;
const MAX_SPEED = 11;

const photos = [
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80'
];

let running = false;
let runnerBottom = GROUND_HEIGHT;
let velocityY = 0;
let score = 0;
let passed = 0;
let speed = BASE_SPEED;
let lastFrame = 0;
let distance = 0;
let obstacleTimer = 0;
let obstacleGap = 1200;
let rafId = null;
const obstacles = [];

const bestScore = Number(localStorage.getItem('parkourBest') || 0);
bestNode.textContent = String(bestScore);

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function setRandomPhotoBackground() {
  const pick = photos[Math.floor(Math.random() * photos.length)];
  arena.style.backgroundImage = `linear-gradient(rgb(2 6 23 / 35%), rgb(2 6 23 / 55%)), url(${pick})`;
}

function jump() {
  if (!running) return;
  if (runnerBottom <= GROUND_HEIGHT + 2) {
    velocityY = JUMP_FORCE;
  }
}

function createObstacle() {
  const obstacle = document.createElement('div');
  obstacle.className = 'obstacle';
  obstacle.style.height = `${Math.floor(randomBetween(38, 88))}px`;
  obstacle.style.left = `${arena.clientWidth + 24}px`;
  obstacle.dataset.passed = '0';
  arena.appendChild(obstacle);
  obstacles.push(obstacle);
}

function isColliding(obstacleRect, runnerRect) {
  return !(
    runnerRect.right < obstacleRect.left + 6 ||
    runnerRect.left > obstacleRect.right - 6 ||
    runnerRect.bottom < obstacleRect.top + 5 ||
    runnerRect.top > obstacleRect.bottom - 5
  );
}

function endGame() {
  running = false;
  cancelAnimationFrame(rafId);

  const currentBest = Number(localStorage.getItem('parkourBest') || 0);
  if (score > currentBest) {
    localStorage.setItem('parkourBest', String(score));
    bestNode.textContent = String(score);
    hint.textContent = `撞上障碍！本局 ${score} 分，已刷新纪录，点击“再跑一次”继续。`;
  } else {
    hint.textContent = `撞上障碍！本局 ${score} 分，点击“再跑一次”继续。`;
  }

  startBtn.disabled = false;
  startBtn.textContent = '再跑一次';
}

function update(deltaMs) {
  velocityY -= GRAVITY;
  runnerBottom += velocityY;

  if (runnerBottom < GROUND_HEIGHT) {
    runnerBottom = GROUND_HEIGHT;
    velocityY = 0;
  }
  runner.style.bottom = `${runnerBottom}px`;

  speed = Math.min(MAX_SPEED, BASE_SPEED + distance / 1800);

  obstacleTimer += deltaMs;
  if (obstacleTimer >= obstacleGap) {
    obstacleTimer = 0;
    obstacleGap = randomBetween(700, 1550);
    createObstacle();
  }

  const runnerRect = runner.getBoundingClientRect();

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i];
    const currentLeft = Number.parseFloat(obstacle.style.left);
    const nextLeft = currentLeft - speed;
    obstacle.style.left = `${nextLeft}px`;

    const obstacleRect = obstacle.getBoundingClientRect();
    if (isColliding(obstacleRect, runnerRect)) {
      endGame();
      return;
    }

    if (obstacle.dataset.passed === '0' && obstacleRect.right < runnerRect.left) {
      obstacle.dataset.passed = '1';
      passed += 1;
      passedNode.textContent = String(passed);
    }

    if (nextLeft < -60) {
      obstacle.remove();
      obstacles.splice(i, 1);
    }
  }

  distance += speed;
  score = Math.floor(distance / 10 + passed * 20);
  scoreNode.textContent = String(score);
}

function gameLoop(timestamp) {
  if (!running) return;

  if (!lastFrame) {
    lastFrame = timestamp;
  }

  const deltaMs = timestamp - lastFrame;
  lastFrame = timestamp;

  update(deltaMs);
  rafId = requestAnimationFrame(gameLoop);
}

function resetScene() {
  for (const obstacle of obstacles) {
    obstacle.remove();
  }
  obstacles.length = 0;

  runnerBottom = GROUND_HEIGHT;
  velocityY = 0;
  distance = 0;
  obstacleTimer = 0;
  obstacleGap = 1200;
  speed = BASE_SPEED;
  score = 0;
  passed = 0;
  lastFrame = 0;

  runner.style.bottom = `${GROUND_HEIGHT}px`;
  scoreNode.textContent = '0';
  passedNode.textContent = '0';
}

function startGame() {
  if (running) return;

  resetScene();
  setRandomPhotoBackground();

  running = true;
  startBtn.disabled = true;
  startBtn.textContent = '跑酷中...';
  hint.textContent = '正在冲刺！按空格（或点击区域）持续跳跃躲避障碍。';

  rafId = requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', startGame);
arena.addEventListener('click', jump);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    jump();
  }
});
