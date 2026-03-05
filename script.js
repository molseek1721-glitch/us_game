const scoreNode = document.getElementById('score');
const passedNode = document.getElementById('passed');
const bestNode = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');
const arena = document.getElementById('arena');
const runner = document.getElementById('runner');
const hint = document.getElementById('hint');
const pageVideo = document.getElementById('pageVideo');
const videoSource = document.getElementById('videoSource');

const videoInput = document.getElementById('videoInput');
const bgInput = document.getElementById('bgInput');
const obstacleInput = document.getElementById('obstacleInput');
const addVideoBtn = document.getElementById('addVideoBtn');
const nextVideoBtn = document.getElementById('nextVideoBtn');
const addBgBtn = document.getElementById('addBgBtn');
const addObstacleBtn = document.getElementById('addObstacleBtn');

const GROUND_HEIGHT = 48;
const PLAYER_WIDTH = 54;
const PLAYER_HEIGHT = 78;
const HORIZONTAL_SPEED = 5.8;
const VERTICAL_JUMP = 15.2;
const GRAVITY = 0.82;
const BASE_SPEED = 6;
const MAX_SPEED = 12.8;

const videoUrls = [
  'https://cdn.pixabay.com/video/2019/05/26/23969-338327820_large.mp4'
];

const bgPhotos = [
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80'
];

const obstaclePhotos = [
  'https://images.unsplash.com/photo-1438029071396-1e831a7fa6d8?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1456926631375-92c8ce872def?auto=format&fit=crop&w=300&q=80'
];

let videoIndex = 0;
let running = false;
let muted = false;
let x = 96;
let y = GROUND_HEIGHT;
let vx = 0;
let vy = 0;
let score = 0;
let passed = 0;
let distance = 0;
let speed = BASE_SPEED;
let obstacleTimer = 0;
let obstacleGap = 950;
let lastFrame = 0;
let rafId = null;
const obstacles = [];
const pressed = new Set();

let audioContext;
let bgmOsc;
let bgmGain;

const bestScore = Number(localStorage.getItem('parkourBest') || 0);
bestNode.textContent = String(bestScore);

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function initAudio() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }
}

function playSfx(type) {
  if (muted) return;
  initAudio();

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);

  const now = audioContext.currentTime;
  if (type === 'jump') {
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
  } else if (type === 'pass') {
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.08);
  } else {
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.18);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  osc.type = type === 'hit' ? 'square' : 'triangle';
  osc.start(now);
  osc.stop(now + 0.22);
}

function startBgm() {
  if (muted) return;
  initAudio();
  if (bgmOsc) return;

  bgmOsc = audioContext.createOscillator();
  bgmGain = audioContext.createGain();
  bgmOsc.connect(bgmGain);
  bgmGain.connect(audioContext.destination);
  bgmOsc.type = 'sine';
  bgmOsc.frequency.value = 132;
  bgmGain.gain.value = 0.03;
  bgmOsc.start();
}

function stopBgm() {
  if (!bgmOsc) return;
  bgmOsc.stop();
  bgmOsc.disconnect();
  bgmGain.disconnect();
  bgmOsc = null;
  bgmGain = null;
}

function setRandomPhotoBackground() {
  arena.style.backgroundImage = `linear-gradient(rgb(2 6 23 / 34%), rgb(2 6 23 / 52%)), url(${pickRandom(bgPhotos)})`;
}

function applyCurrentVideo() {
  videoSource.src = videoUrls[videoIndex];
  pageVideo.load();
  pageVideo.play().catch(() => {
    hint.textContent = '视频自动播放被浏览器限制，可点击页面后再播放。';
  });
}

function getRunnerRect() {
  return {
    left: x,
    right: x + PLAYER_WIDTH,
    bottom: y,
    top: y + PLAYER_HEIGHT
  };
}

function updateRunnerStyle() {
  runner.style.left = `${x}px`;
  runner.style.bottom = `${y}px`;
}

function createObstacle() {
  const arenaHeight = arena.clientHeight;
  const typeRoll = Math.random();
  const obstacle = document.createElement('div');
  obstacle.className = 'obstacle';

  let type = 'ground';
  let height = randomBetween(45, 95);
  let width = randomBetween(36, 56);
  let bottom = GROUND_HEIGHT;

  if (typeRoll > 0.66) {
    type = 'flying';
    height = randomBetween(34, 58);
    width = randomBetween(40, 64);
    bottom = randomBetween(GROUND_HEIGHT + 95, arenaHeight - 100);
  } else if (typeRoll > 0.33) {
    type = 'tall';
    height = randomBetween(88, 135);
    width = randomBetween(32, 48);
  }

  obstacle.style.width = `${width}px`;
  obstacle.style.height = `${height}px`;
  obstacle.style.left = `${arena.clientWidth + 32}px`;
  obstacle.style.bottom = `${bottom}px`;
  obstacle.style.backgroundImage = `url(${pickRandom(obstaclePhotos)})`;
  obstacle.dataset.passed = '0';
  obstacle.dataset.type = type;

  arena.appendChild(obstacle);
  obstacles.push(obstacle);
}

function isColliding(a, b) {
  return !(a.right < b.left + 6 || a.left > b.right - 6 || a.bottom > b.top - 6 || a.top < b.bottom + 6);
}

function endGame() {
  running = false;
  cancelAnimationFrame(rafId);
  stopBgm();
  playSfx('hit');

  const currentBest = Number(localStorage.getItem('parkourBest') || 0);
  if (score > currentBest) {
    localStorage.setItem('parkourBest', String(score));
    bestNode.textContent = String(score);
    hint.textContent = `碰撞失败！本局 ${score} 分，刷新纪录 🎉 点击“再跑一次”。`;
  } else {
    hint.textContent = `碰撞失败！本局 ${score} 分，点击“再跑一次”。`;
  }

  startBtn.disabled = false;
  startBtn.textContent = '再跑一次';
}

function clampPosition() {
  const maxX = arena.clientWidth - PLAYER_WIDTH - 8;
  const minX = 8;
  if (x < minX) x = minX;
  if (x > maxX) x = maxX;
}

function handleMovement() {
  vx = 0;

  if (pressed.has('ArrowLeft') || pressed.has('KeyA')) {
    vx = -HORIZONTAL_SPEED;
  }
  if (pressed.has('ArrowRight') || pressed.has('KeyD')) {
    vx = HORIZONTAL_SPEED;
  }
  if ((pressed.has('ArrowUp') || pressed.has('KeyW') || pressed.has('Space')) && y <= GROUND_HEIGHT + 2) {
    vy = VERTICAL_JUMP;
    playSfx('jump');
  }
  if (pressed.has('ArrowDown') || pressed.has('KeyS')) {
    vy -= 1.6;
  }
}

function update(deltaMs) {
  handleMovement();

  x += vx;
  vy -= GRAVITY;
  y += vy;

  if (y < GROUND_HEIGHT) {
    y = GROUND_HEIGHT;
    vy = 0;
  }

  clampPosition();
  updateRunnerStyle();

  speed = Math.min(MAX_SPEED, BASE_SPEED + distance / 1700);
  obstacleTimer += deltaMs;
  if (obstacleTimer >= obstacleGap) {
    obstacleTimer = 0;
    obstacleGap = randomBetween(620, 1250);
    createObstacle();
  }

  const runnerRect = getRunnerRect();

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i];
    const w = Number.parseFloat(obstacle.style.width);
    const h = Number.parseFloat(obstacle.style.height);
    const left = Number.parseFloat(obstacle.style.left) - speed;
    const bottom = Number.parseFloat(obstacle.style.bottom);

    obstacle.style.left = `${left}px`;

    const obstacleRect = {
      left,
      right: left + w,
      bottom,
      top: bottom + h
    };

    if (isColliding(runnerRect, obstacleRect)) {
      endGame();
      return;
    }

    if (obstacle.dataset.passed === '0' && obstacleRect.right < runnerRect.left) {
      obstacle.dataset.passed = '1';
      passed += 1;
      passedNode.textContent = String(passed);
      playSfx('pass');
    }

    if (left < -w - 20) {
      obstacle.remove();
      obstacles.splice(i, 1);
    }
  }

  distance += speed;
  score = Math.floor(distance / 10 + passed * 28);
  scoreNode.textContent = String(score);
}

function gameLoop(timestamp) {
  if (!running) return;
  if (!lastFrame) lastFrame = timestamp;

  const deltaMs = timestamp - lastFrame;
  lastFrame = timestamp;

  update(deltaMs);
  rafId = requestAnimationFrame(gameLoop);
}

function resetScene() {
  for (const obstacle of obstacles) obstacle.remove();
  obstacles.length = 0;

  x = 96;
  y = GROUND_HEIGHT;
  vx = 0;
  vy = 0;
  score = 0;
  passed = 0;
  distance = 0;
  speed = BASE_SPEED;
  obstacleTimer = 0;
  obstacleGap = 950;
  lastFrame = 0;

  scoreNode.textContent = '0';
  passedNode.textContent = '0';
  updateRunnerStyle();
}

function startGame() {
  if (running) return;

  initAudio();
  audioContext.resume();
  resetScene();
  setRandomPhotoBackground();
  startBgm();

  running = true;
  startBtn.disabled = true;
  startBtn.textContent = '跑酷中...';
  hint.textContent = '冲刺中！方向键/WASD 控制上下左右，空格跳跃，↓可急降。';

  rafId = requestAnimationFrame(gameLoop);
}

function toggleMute() {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇 音效关' : '🔊 音效开';
  if (muted) {
    stopBgm();
  } else if (running) {
    startBgm();
  }
}

function addResource(input, list, label) {
  const url = input.value.trim();
  if (!url) return;

  const isAllowed = /^https?:\/\/.+\.(mp4|jpg|jpeg|png|webp)(\?.*)?$/i.test(url);
  if (!isAllowed) {
    hint.textContent = `${label}格式不正确，请使用可访问的 mp4/jpg/png/webp 地址。`;
    return;
  }

  list.push(url);
  input.value = '';
  hint.textContent = `已添加${label}，当前共 ${list.length} 个。`;
}

startBtn.addEventListener('click', startGame);
muteBtn.addEventListener('click', toggleMute);

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    pressed.add(event.code);
  }
});

window.addEventListener('keyup', (event) => {
  pressed.delete(event.code);
});

arena.addEventListener('click', () => {
  pressed.add('Space');
  setTimeout(() => pressed.delete('Space'), 80);
});

addVideoBtn.addEventListener('click', () => addResource(videoInput, videoUrls, '视频'));
nextVideoBtn.addEventListener('click', () => {
  videoIndex = (videoIndex + 1) % videoUrls.length;
  applyCurrentVideo();
  hint.textContent = `已切换背景视频（${videoIndex + 1}/${videoUrls.length}）。`;
});
addBgBtn.addEventListener('click', () => addResource(bgInput, bgPhotos, '背景照片'));
addObstacleBtn.addEventListener('click', () => addResource(obstacleInput, obstaclePhotos, '障碍物照片'));

updateRunnerStyle();
applyCurrentVideo();
