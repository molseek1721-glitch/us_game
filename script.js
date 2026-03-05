const scoreNode = document.getElementById('score');
const passedNode = document.getElementById('passed');
const bestNode = document.getElementById('best');
const speedLabel = document.getElementById('speedLabel');
const difficultyLabel = document.getElementById('difficultyLabel');

const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const arena = document.getElementById('arena');
const gameShell = document.getElementById('gameShell');
const runner = document.getElementById('runner');
const hint = document.getElementById('hint');
const pageVideo = document.getElementById('pageVideo');

const videoFolderInput = document.getElementById('videoFolderInput');
const bgFolderInput = document.getElementById('bgFolderInput');
const obstacleFolderInput = document.getElementById('obstacleFolderInput');
const runnerFramesInput = document.getElementById('runnerFramesInput');
const speedSlider = document.getElementById('speedSlider');
const difficultySlider = document.getElementById('difficultySlider');
const zoomSlider = document.getElementById('zoomSlider');

const GROUND_HEIGHT = 56;
const BASE_PLAYER_WIDTH = 68;
const BASE_PLAYER_HEIGHT = 98;
const HORIZONTAL_SPEED = 6;
const VERTICAL_JUMP = 15.6;
const GRAVITY = 0.82;
const BASE_SPEED = 5.6;
const MAX_SPEED = 14;

const defaultRunnerFrames = [
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=220&q=80',
  'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=220&q=80'
];
const defaultBgPhotos = [
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80'
];
const defaultObstaclePhotos = [
  'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=300&q=80'
];

const videoUrls = [];
const bgPhotos = [...defaultBgPhotos];
const obstaclePhotos = [...defaultObstaclePhotos];
const runnerFrames = [...defaultRunnerFrames];

let running = false;
let muted = false;
let x = 130;
let y = GROUND_HEIGHT;
let vx = 0;
let vy = 0;
let score = 0;
let passed = 0;
let distance = 0;
let speed = BASE_SPEED;
let obstacleTimer = 0;
let obstacleGap = 1050;
let lastFrame = 0;
let rafId = null;
let speedFactor = 1;
let difficulty = 2;
let frameCursor = 0;
let frameElapsed = 0;

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
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.11);
  } else if (type === 'pass') {
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(930, now + 0.08);
  } else {
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.type = type === 'hit' ? 'square' : 'triangle';
  osc.start(now);
  osc.stop(now + 0.24);
}

function startBgm() {
  if (muted) return;
  initAudio();
  if (bgmOsc) return;
  bgmOsc = audioContext.createOscillator();
  bgmGain = audioContext.createGain();
  bgmOsc.connect(bgmGain);
  bgmGain.connect(audioContext.destination);
  bgmOsc.type = 'sawtooth';
  bgmOsc.frequency.value = 120;
  bgmGain.gain.value = 0.022;
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
  arena.style.backgroundImage = `linear-gradient(rgb(2 6 23 / 36%), rgb(2 6 23 / 56%)), url(${pickRandom(bgPhotos)})`;
}

function applyVideo(url) {
  pageVideo.src = url;
  pageVideo.load();
  pageVideo.play().catch(() => {
    hint.textContent = '浏览器限制了自动播放，请先点击页面后再播放本地视频。';
  });
}

function applyRunnerFrame(index) {
  runner.style.backgroundImage = `url(${runnerFrames[index % runnerFrames.length]})`;
}

function getRunnerRect() {
  const width = runner.clientWidth;
  const height = runner.clientHeight;
  return {
    left: x,
    right: x + width,
    bottom: y,
    top: y + height
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

  let height = randomBetween(48, 110);
  let width = randomBetween(44, 66);
  let bottom = GROUND_HEIGHT;

  if (typeRoll > 0.68) {
    height = randomBetween(36, 64);
    width = randomBetween(50, 82);
    bottom = randomBetween(GROUND_HEIGHT + 120, arenaHeight - 120);
  } else if (typeRoll > 0.36) {
    height = randomBetween(98, 168);
    width = randomBetween(38, 56);
  }

  obstacle.style.width = `${width}px`;
  obstacle.style.height = `${height}px`;
  obstacle.style.left = `${arena.clientWidth + 36}px`;
  obstacle.style.bottom = `${bottom}px`;
  obstacle.style.backgroundImage = `url(${pickRandom(obstaclePhotos)})`;
  obstacle.dataset.passed = '0';

  arena.appendChild(obstacle);
  obstacles.push(obstacle);
}

function isColliding(a, b) {
  return !(a.right < b.left + 8 || a.left > b.right - 8 || a.top < b.bottom + 6 || a.bottom > b.top - 6);
}

function getDifficultyName(level) {
  if (level === 1) return '简单';
  if (level === 2) return '普通';
  return '困难';
}

function difficultyConfig(level) {
  if (level === 1) return { gapMin: 980, gapMax: 1600, speedBonus: 0 };
  if (level === 2) return { gapMin: 700, gapMax: 1200, speedBonus: 1.4 };
  return { gapMin: 500, gapMax: 900, speedBonus: 2.6 };
}

function updateLabels() {
  speedLabel.textContent = `${speedFactor.toFixed(1)}x`;
  difficultyLabel.textContent = getDifficultyName(difficulty);
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
    hint.textContent = `碰撞失败！本局 ${score} 分，刷新纪录 🎉`;
  } else {
    hint.textContent = `碰撞失败！本局 ${score} 分。`;
  }

  startBtn.disabled = false;
  startBtn.textContent = '再跑一次';
  runner.classList.remove('jump', 'slide', 'left', 'right');
  runner.classList.add('running');
}

function animateRunnerFrames(deltaMs) {
  frameElapsed += deltaMs;
  if (frameElapsed > 110) {
    frameElapsed = 0;
    frameCursor = (frameCursor + 1) % runnerFrames.length;
    applyRunnerFrame(frameCursor);
  }
}

function clampPosition() {
  const width = runner.clientWidth;
  const maxX = arena.clientWidth - width - 10;
  const minX = 10;
  if (x < minX) x = minX;
  if (x > maxX) x = maxX;
}

function updateActionClass() {
  runner.classList.remove('left', 'right', 'slide');
  if (pressed.has('ArrowLeft') || pressed.has('KeyA')) runner.classList.add('left');
  if (pressed.has('ArrowRight') || pressed.has('KeyD')) runner.classList.add('right');
  if (pressed.has('ArrowDown') || pressed.has('KeyS')) runner.classList.add('slide');
}

function handleMovement() {
  vx = 0;
  if (pressed.has('ArrowLeft') || pressed.has('KeyA')) vx = -HORIZONTAL_SPEED;
  if (pressed.has('ArrowRight') || pressed.has('KeyD')) vx = HORIZONTAL_SPEED;

  if ((pressed.has('ArrowUp') || pressed.has('KeyW') || pressed.has('Space')) && y <= GROUND_HEIGHT + 2) {
    vy = VERTICAL_JUMP;
    runner.classList.add('jump');
    setTimeout(() => runner.classList.remove('jump'), 420);
    playSfx('jump');
  }

  if (pressed.has('ArrowDown') || pressed.has('KeyS')) {
    vy -= 1.8;
  }

  updateActionClass();
}

function update(deltaMs) {
  handleMovement();
  animateRunnerFrames(deltaMs);

  x += vx;
  vy -= GRAVITY;
  y += vy;

  if (y < GROUND_HEIGHT) {
    y = GROUND_HEIGHT;
    vy = 0;
  }

  clampPosition();
  updateRunnerStyle();

  const cfg = difficultyConfig(difficulty);
  speed = Math.min(MAX_SPEED, BASE_SPEED + cfg.speedBonus + distance / 1700) * speedFactor;
  obstacleTimer += deltaMs;

  if (obstacleTimer >= obstacleGap) {
    obstacleTimer = 0;
    obstacleGap = randomBetween(cfg.gapMin, cfg.gapMax) / speedFactor;
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

    const obstacleRect = { left, right: left + w, bottom, top: bottom + h };
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

    if (left < -w - 25) {
      obstacle.remove();
      obstacles.splice(i, 1);
    }
  }

  distance += speed;
  score = Math.floor(distance / 10 + passed * 34 + difficulty * 10);
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

  x = 130;
  y = GROUND_HEIGHT;
  vx = 0;
  vy = 0;
  score = 0;
  passed = 0;
  distance = 0;
  speed = BASE_SPEED;
  obstacleTimer = 0;
  obstacleGap = 1050;
  lastFrame = 0;
  frameCursor = 0;
  frameElapsed = 0;

  scoreNode.textContent = '0';
  passedNode.textContent = '0';
  updateRunnerStyle();
  applyRunnerFrame(0);
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
  hint.textContent = '进行中：↑/W/空格跳跃，↓/S下蹲速降，←→左右位移。';
  rafId = requestAnimationFrame(gameLoop);
}

function toggleMute() {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇 音效关' : '🔊 音效开';
  if (muted) stopBgm();
  else if (running) startBgm();
}

function applyZoom(value) {
  gameShell.style.setProperty('--zoom', value);
}

function enterOrExitFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      hint.textContent = '全屏请求被浏览器阻止，请手动允许。';
    });
  } else {
    document.exitFullscreen();
  }
}

function filterByType(files, typePrefix) {
  return [...files].filter((file) => file.type.startsWith(typePrefix));
}

function toObjectUrls(files) {
  return files.map((file) => URL.createObjectURL(file));
}

function loadFolderResources(input, targetList, typePrefix, label) {
  const files = filterByType(input.files, typePrefix);
  if (!files.length) {
    hint.textContent = `${label}文件夹中未找到可用资源。`;
    return;
  }

  targetList.length = 0;
  targetList.push(...toObjectUrls(files));
  hint.textContent = `${label}已加载 ${targetList.length} 个本地文件。`;
}

startBtn.addEventListener('click', startGame);
muteBtn.addEventListener('click', toggleMute);
fullscreenBtn.addEventListener('click', enterOrExitFullscreen);

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyF') {
    enterOrExitFullscreen();
    return;
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    pressed.add(event.code);
  }
});

window.addEventListener('keyup', (event) => {
  pressed.delete(event.code);
});

videoFolderInput.addEventListener('change', () => {
  const files = [...videoFolderInput.files].filter((file) => file.type === 'video/mp4');
  if (!files.length) {
    hint.textContent = '视频文件夹中未找到 MP4 文件。';
    return;
  }

  videoUrls.length = 0;
  videoUrls.push(...toObjectUrls(files));
  applyVideo(videoUrls[0]);
  hint.textContent = `已加载 ${videoUrls.length} 个本地 MP4 视频。`;
});

bgFolderInput.addEventListener('change', () => {
  loadFolderResources(bgFolderInput, bgPhotos, 'image/', '背景图片');
});

obstacleFolderInput.addEventListener('change', () => {
  loadFolderResources(obstacleFolderInput, obstaclePhotos, 'image/', '障碍图片');
});

runnerFramesInput.addEventListener('change', () => {
  loadFolderResources(runnerFramesInput, runnerFrames, 'image/', '人物动作帧');
  applyRunnerFrame(0);
});

speedSlider.addEventListener('input', () => {
  speedFactor = Number(speedSlider.value);
  updateLabels();
});

difficultySlider.addEventListener('input', () => {
  difficulty = Number(difficultySlider.value);
  updateLabels();
});

zoomSlider.addEventListener('input', () => {
  applyZoom(zoomSlider.value);
});

document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.textContent = document.fullscreenElement ? '🡽 退出全屏' : '⛶ 全屏';
});

applyRunnerFrame(0);
updateRunnerStyle();
setRandomPhotoBackground();
updateLabels();
if (videoUrls.length) {
  applyVideo(videoUrls[0]);
}
