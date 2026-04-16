import * as THREE from "./vendor/three.module.js";

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1020');
scene.fog = new THREE.Fog('#0d1428', 60, 520);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const hemi = new THREE.HemisphereLight('#7fb7ff', '#0b1020', 0.45);
scene.add(hemi);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
dirLight.position.set(-20, 30, 18);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
scene.add(dirLight);

const laneLength = 420;
const laneWidth = 28;
const startSafeZ = 18;
const brainrots = [];
const waves = [];
const maxBrainrots = 22;
let banked = 0;
let carrying = null;
let nextWave = 14 + Math.random() * 9;
let speedLevel = 0;

const rarities = [
  { name: 'Common', value: 5, color: '#9ca3af', minZ: 20, maxZ: 120 },
  { name: 'Rare', value: 15, color: '#7bd4ff', minZ: 120, maxZ: 230 },
  { name: 'Epic', value: 35, color: '#d6a7ff', minZ: 230, maxZ: 320 },
  { name: 'Legendary', value: 80, color: '#ffd166', minZ: 320, maxZ: laneLength - 8 }
];

const input = { forward: false, back: false, left: false, right: false, sprint: false, turnLeft: false, turnRight: false };
const justPressed = new Set();

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = true;
  if (e.code === 'KeyA') input.left = true;
  if (e.code === 'KeyD') input.right = true;
  if (e.code === 'Space') input.sprint = true;
  if (e.code === 'KeyQ' || e.code === 'ArrowLeft') input.turnLeft = true;
  if (e.code === 'KeyE' || e.code === 'ArrowRight') input.turnRight = true;
  if (e.code === 'KeyF' && !e.repeat) justPressed.add('F');
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = false;
  if (e.code === 'KeyA') input.left = false;
  if (e.code === 'KeyD') input.right = false;
  if (e.code === 'Space') input.sprint = false;
  if (e.code === 'KeyQ' || e.code === 'ArrowLeft') input.turnLeft = false;
  if (e.code === 'KeyE' || e.code === 'ArrowRight') input.turnRight = false;
});

// Ground & lanes
const groundMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.9, metalness: 0.05 });
const ground = new THREE.Mesh(new THREE.BoxGeometry(laneWidth, 2, laneLength + 20), groundMat);
ground.position.set(0, -1.1, laneLength / 2 - 10);
ground.receiveShadow = true;
scene.add(ground);

// Side walls
const wallMat = new THREE.MeshStandardMaterial({ color: '#0b1224', roughness: 0.7 });
const leftWall = new THREE.Mesh(new THREE.BoxGeometry(2, 10, laneLength + 20), wallMat);
leftWall.position.set(-laneWidth / 2 - 1, 4, laneLength / 2 - 10);
const rightWall = leftWall.clone();
rightWall.position.x = laneWidth / 2 + 1;
scene.add(leftWall, rightWall);

// Start safe pad
const startPad = new THREE.Mesh(new THREE.BoxGeometry(laneWidth, 1, startSafeZ), new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0ea5e9', emissiveIntensity: 0.25 }));
startPad.position.set(0, -0.6, startSafeZ / 2 - 2);
startPad.receiveShadow = true;
scene.add(startPad);

// Finish wall
const finishWall = new THREE.Mesh(new THREE.BoxGeometry(laneWidth, 8, 2), new THREE.MeshStandardMaterial({ color: '#4c1d95', emissive: '#4c1d95', emissiveIntensity: 0.3 }));
finishWall.position.set(0, 4, laneLength);
scene.add(finishWall);

// Player
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.1, 6, 12), new THREE.MeshStandardMaterial({ color: '#f1f5f9', metalness: 0.2, roughness: 0.5 }));
body.castShadow = true;
player.add(body);
scene.add(player);

player.position.set(0, 1, 4);
let yaw = 0;
let velocity = new THREE.Vector3();
const playerBox = new THREE.Box3();

// Shops
const shops = [];
function buildShop({ position, cost, label, effect }) {
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.8, 12), new THREE.MeshStandardMaterial({ color: '#d97706' }));
  pedestal.position.copy(position);
  pedestal.position.y = -0.2;
  const holo = new THREE.Mesh(new THREE.TorusKnotGeometry(0.9, 0.24, 64, 8), new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.8, transparent: true, opacity: 0.9 }));
  holo.position.copy(position);
  holo.position.y = 2.2;
  scene.add(pedestal, holo);
  shops.push({ position, cost, label, effect, mesh: pedestal });
}

buildShop({ position: new THREE.Vector3(-6, 0, 6), cost: 40, label: 'Speed +1', effect: () => { speedLevel++; } });
buildShop({ position: new THREE.Vector3(6, 0, 6), cost: 60, label: 'Sustain sprint', effect: () => { sprintStamina = Math.min(sprintStamina + 1.5, 4); } });

let sprintStamina = 1.5;
let sprintReserve = sprintStamina;

// Brainrot spawner
const brainGeo = new THREE.IcosahedronGeometry(1.1, 1);
function spawnBrainrot() {
  if (brainrots.length >= maxBrainrots) return;
  const rarity = rarities[Math.floor(Math.random() * rarities.length)];
  const z = rarity.minZ + Math.random() * (rarity.maxZ - rarity.minZ);
  const x = (Math.random() * 0.8 - 0.4) * laneWidth;
  const mat = new THREE.MeshStandardMaterial({ color: rarity.color, emissive: rarity.color, emissiveIntensity: 0.6, roughness: 0.2 });
  const mesh = new THREE.Mesh(brainGeo, mat);
  mesh.castShadow = true;
  mesh.position.set(x, 1.2, z);
  mesh.userData = rarity;
  scene.add(mesh);
  brainrots.push(mesh);
}

for (let i = 0; i < 12; i++) spawnBrainrot();

// Lane stripes for depth perception
const stripeMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 0.5 });
for (let z = 14; z < laneLength; z += 12) {
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 4), stripeMat);
  stripe.position.set(0, -0.9, z);
  stripe.receiveShadow = true;
  scene.add(stripe);
}

function setToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  if (!text) return;
  toast.style.opacity = 1;
  setTimeout(() => { toast.style.opacity = 0.4; }, 1600);
}

function updateHUD() {
  document.getElementById('bank').textContent = banked;
  document.getElementById('carry').textContent = carrying ? `${carrying.name} (+${carrying.value})` : 'None';
  document.getElementById('wave-timer').textContent = nextWave.toFixed(1);
  document.getElementById('speed').textContent = (8 + speedLevel).toFixed(1);
}

function clampPlayer() {
  const half = laneWidth / 2 - 1.2;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -half, half);
  player.position.z = THREE.MathUtils.clamp(player.position.z, 0.5, laneLength - 1);
}

function killPlayer(reason = 'Wiped') {
  carrying = null;
  velocity.set(0, 0, 0);
  player.position.set(0, 1, 4);
  setToast(`${reason}! Respawned at start.`);
}

function handleDeposits() {
  if (player.position.z <= startSafeZ - 4 && carrying) {
    banked += carrying.value;
    setToast(`Banked ${carrying.name} (+${carrying.value})`);
    carrying = null;
  }
}

function handleBrainrotCollisions() {
  playerBox.setFromCenterAndSize(player.position, new THREE.Vector3(1.2, 2, 1.2));
  for (let i = brainrots.length - 1; i >= 0; i--) {
    const b = brainrots[i];
    const box = new THREE.Box3().setFromObject(b);
    if (playerBox.intersectsBox(box)) {
      carrying = b.userData;
      setToast(`Picked up ${carrying.name}! Bring it back.`);
      scene.remove(b);
      brainrots.splice(i, 1);
    }
  }
}

function spawnWave() {
  const thickness = 4;
  const geom = new THREE.BoxGeometry(laneWidth + 2, 6, thickness);
  const mat = new THREE.MeshPhongMaterial({ color: '#3b82f6', transparent: true, opacity: 0.55, shininess: 90 });
  const wave = new THREE.Mesh(geom, mat);
  wave.position.set(0, 2, laneLength + thickness);
  wave.userData = { speed: 20 + Math.random() * 6, thickness };
  scene.add(wave);
  waves.push(wave);
  setToast('TSUNAMI INCOMING!');
}

function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.position.z -= w.userData.speed * dt;
    if (w.position.z < -10) {
      scene.remove(w);
      waves.splice(i, 1);
      continue;
    }
    const dz = Math.abs(w.position.z - player.position.z);
    if (dz < w.userData.thickness + 0.6 && Math.abs(player.position.x) <= laneWidth / 2) {
      killPlayer('Swept by tsunami');
    }
  }
}

const shopHint = document.createElement('div');
shopHint.className = 'shop-hint';
document.body.appendChild(shopHint);

function handleShops() {
  let closest = null;
  let minDist = Infinity;
  for (const shop of shops) {
    const d = shop.position.distanceTo(player.position);
    if (d < minDist) { minDist = d; closest = shop; }
  }
  if (closest && minDist < 5) {
    const { x, y } = worldToScreen(closest.position.clone().setY(2.4));
    shopHint.style.display = 'block';
    shopHint.style.left = `${x}px`;
    shopHint.style.top = `${y}px`;
    shopHint.textContent = `F: ${closest.label} (${closest.cost})`;
    if (justPressed.has('F') && banked >= closest.cost) {
      banked -= closest.cost;
      closest.effect();
      setToast(`Purchased ${closest.label}`);
    }
  } else {
    shopHint.style.display = 'none';
  }
}

function worldToScreen(pos) {
  const vector = pos.clone().project(camera);
  const x = (vector.x + 1) / 2 * window.innerWidth;
  const y = (-vector.y + 1) / 2 * window.innerHeight;
  return { x, y };
}

let lastSpawn = 0;
let lastTime = performance.now();

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updatePlayer(dt);
  handleBrainrotCollisions();
  handleDeposits();

  lastSpawn += dt;
  if (lastSpawn > 2.8) { spawnBrainrot(); lastSpawn = 0; }

  nextWave -= dt;
  if (nextWave <= 0) {
    spawnWave();
    nextWave = 16 + Math.random() * 10;
  }
  updateWaves(dt);

  handleShops();

  renderer.render(scene, camera);
  justPressed.clear();
  requestAnimationFrame(animate);
  updateHUD();
}

function updatePlayer(dt) {
  const turnSpeed = 1.5;
  if (input.turnLeft) yaw += turnSpeed * dt;
  if (input.turnRight) yaw -= turnSpeed * dt;

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).multiplyScalar(-1);

  let accel = new THREE.Vector3();
  if (input.forward) accel.add(forward);
  if (input.back) accel.sub(forward);
  if (input.left) accel.sub(right);
  if (input.right) accel.add(right);
  if (accel.lengthSq() > 0) accel.normalize();

  const baseSpeed = 8 + speedLevel;
  const moveAccel = baseSpeed * 7;

  if (input.sprint && sprintReserve > 0) {
    accel.multiplyScalar(1.35);
    sprintReserve = Math.max(0, sprintReserve - dt * 1.2);
  } else {
    sprintReserve = Math.min(sprintStamina, sprintReserve + dt * 0.6);
  }

  velocity.addScaledVector(accel, moveAccel * dt);
  velocity.multiplyScalar(0.86);

  player.position.addScaledVector(velocity, dt);
  clampPlayer();

  const camOffset = forward.clone().multiplyScalar(-8).add(new THREE.Vector3(0, 5, 2));
  const targetCamPos = player.position.clone().add(camOffset);
  camera.position.lerp(targetCamPos, 0.1);
  camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setToast('Race out, grab loot by rarity zones, and bank before the wave hits.');
updateHUD();
requestAnimationFrame(animate);
