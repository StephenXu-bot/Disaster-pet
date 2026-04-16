// Bright, blocky Tsunami Steal prototype with permanent browser saves, home displays, and camera modes.
(async () => {
  let THREE;
  try {
    THREE = await import('./vendor/three.module.js');
  } catch (localVendorError) {
    console.warn('Local three.js failed, falling back to CDN build.', localVendorError);
    try {
      THREE = await import('https://unpkg.com/three@0.161.0/build/three.module.js');
    } catch (cdnError) {
      console.error('Unable to load three.js from local vendor or CDN.', cdnError);
      const objective = document.getElementById('objective');
      const toast = document.getElementById('toast');
      const wave = document.getElementById('wave-timer');
      const speed = document.getElementById('speed');
      const dash = document.getElementById('dash');
      if (objective) {
        objective.textContent = 'Game failed to boot. Open this page with internet access, or run it through a local web server.';
      }
      if (toast) {
        toast.textContent = 'three.js failed to load, so the 3D scene could not start.';
        toast.style.opacity = '1';
      }
      if (wave) wave.textContent = 'ERR';
      if (speed) speed.textContent = 'ERR';
      if (dash) dash.textContent = 'ERR';
      return;
    }
  }

  const SAVE_SLOT_COUNT = 16;
  const HOUSE_PET_DOCK_COUNT = 5;
  const BEST_SHOWCASE_DOCK_INDEX = 2;
  const CAMERA_MODES = [
    { key: 'third', label: 'Third' },
    { key: 'first', label: 'First' },
    { key: 'second', label: 'Second' }
  ];
  const RARITY_TIERS = [
    { key: 'common', label: 'Common', color: '#7be0b3', value: 10 },
    { key: 'uncommon', label: 'Uncommon', color: '#91f29a', value: 14 },
    { key: 'rare', label: 'Rare', color: '#74c4ff', value: 22 },
    { key: 'epic', label: 'Epic', color: '#d6a1ff', value: 42 },
    { key: 'legendary', label: 'Legendary', color: '#ffd968', value: 72 },
    { key: 'mythic', label: 'Mythic', color: '#ff9ec9', value: 105 },
    { key: 'diamond', label: 'Diamond', color: '#9cefff', value: 138 },
    { key: 'lunar', label: 'Lunar', color: '#cdb7ff', value: 176 },
    { key: 'solar', label: 'Solar', color: '#ffb347', value: 214 },
    { key: 'galaxy', label: 'Galaxy', color: '#7a8cff', value: 252 },
    { key: 'boss', label: 'Boss', color: '#ff6b6b', value: 320 }
  ];
  const RARITY_INDEX = new Map(RARITY_TIERS.map((tier, index) => [tier.key, index]));
  const SECTIONS_PER_TIER = 5;
  const INITIAL_SECTION_COUNT = RARITY_TIERS.length * SECTIONS_PER_TIER;
  const SECTION_RENDER_AHEAD = 18;
  const LANE_SCALE = 5;
  const SECTION_LENGTH = 14;
  const GAP_LENGTH = 8;
  const SECTION_SIDE_X = 13.0 * LANE_SCALE;
  const GAP_PIT_DROP = 1.85;
  const GRAVITY = 28;
  const PLAYER_JUMP_SPEED = 10.8;
  const SPEED_UPGRADE_COST = 55;
  const METEOR_WARNING_SECONDS = 3;
  const METEOR_IMPACT_RADIUS = 7.5;
  const DISASTER_WIND_SECTION_KNOCKBACK = 20;
  const RAIN_SPEED_MULTIPLIER = 0.5;
  const HAZARD_DAMAGE_RADIUS = 6.5;
  const INFINITE_BANKED = 9999999999999999;
  const FREE_CHEAT_UPGRADES = true;
  const INCOME_INFINITY_THRESHOLD = 1e219;
  const PET_PICKUP_LIMIT = 24;
  const PET_TYPES = [
    { key: 'none', label: 'None', speedBonus: 0, dashRegenBonus: 0, bankMultiplier: 1, model: 'none', minTier: 'common', incomePerSecond: 0, upgradeBaseCost: 0 },
    { key: 'frog', label: 'Frog', speedBonus: 0.22, dashRegenBonus: 0.12, bankMultiplier: 1.02, model: 'frog', minTier: 'common', incomePerSecond: 1.2, upgradeBaseCost: 22 },
    { key: 'deer', label: 'Deer', speedBonus: 0.62, dashRegenBonus: 0.08, bankMultiplier: 1.05, model: 'deer', minTier: 'uncommon', incomePerSecond: 2.4, upgradeBaseCost: 40 },
    { key: 'cow', label: 'Cow', speedBonus: 0.12, dashRegenBonus: 0.05, bankMultiplier: 1.18, model: 'cow', minTier: 'rare', incomePerSecond: 4.2, upgradeBaseCost: 68 },
    { key: 'tiger', label: 'Tiger', speedBonus: 0.95, dashRegenBonus: 0.15, bankMultiplier: 1.08, model: 'tiger', minTier: 'epic', incomePerSecond: 7.5, upgradeBaseCost: 112 },
    { key: 'lion', label: 'Lion', speedBonus: 1.05, dashRegenBonus: 0.18, bankMultiplier: 1.16, model: 'lion', minTier: 'legendary', incomePerSecond: 11.5, upgradeBaseCost: 168 },
    { key: 'dragon', label: 'Dragon', speedBonus: 1.45, dashRegenBonus: 0.24, bankMultiplier: 1.35, model: 'dragon', minTier: 'boss', incomePerSecond: 18, upgradeBaseCost: 300 }
  ];
  const PET_BATTLE_SKILLS = {
    frog: [
      { name: 'Mud Leap', power: 20, scale: 2.2, anim: 'leap' },
      { name: 'Bubble Guard', power: 14, scale: 2.8, anim: 'bubble' },
      { name: 'Tongue Snap', power: 28, scale: 2.0, anim: 'snap' },
      { name: 'Pond Slam', power: 38, scale: 2.6, anim: 'slam' }
    ],
    deer: [
      { name: 'Antler Rush', power: 26, scale: 2.5, anim: 'rush' },
      { name: 'Forest Kick', power: 30, scale: 2.1, anim: 'kick' },
      { name: 'Moon Sprint', power: 36, scale: 2.7, anim: 'moon' },
      { name: 'Horn Comet', power: 46, scale: 3.0, anim: 'comet' }
    ],
    cow: [
      { name: 'Milk Shield', power: 24, scale: 2.4, anim: 'shield' },
      { name: 'Barn Bash', power: 34, scale: 2.2, anim: 'bash' },
      { name: 'Hoof Quake', power: 42, scale: 2.8, anim: 'quake' },
      { name: 'Stampede', power: 52, scale: 3.1, anim: 'stampede' }
    ],
    tiger: [
      { name: 'Stripe Slash', power: 38, scale: 3.0, anim: 'slash' },
      { name: 'Pounce', power: 44, scale: 2.8, anim: 'pounce' },
      { name: 'Fang Burst', power: 54, scale: 3.2, anim: 'fang' },
      { name: 'Jungle Fury', power: 68, scale: 3.6, anim: 'fury' }
    ],
    lion: [
      { name: 'Royal Claw', power: 48, scale: 3.2, anim: 'claw' },
      { name: 'Mane Guard', power: 42, scale: 3.8, anim: 'guard' },
      { name: 'King Roar', power: 64, scale: 3.5, anim: 'roar' },
      { name: 'Crown Breaker', power: 78, scale: 4.0, anim: 'crown' }
    ],
    dragon: [
      { name: 'Flame Bite', power: 62, scale: 4.2, anim: 'flame' },
      { name: 'Wing Cutter', power: 74, scale: 4.0, anim: 'wing' },
      { name: 'Lunar Fire', power: 92, scale: 4.8, anim: 'lunar' },
      { name: 'Boss Meteor', power: 128, scale: 5.4, anim: 'meteor' }
    ]
  };
  const PET_CARD_HEIGHTS = {
    frog: 1.75,
    deer: 2.4,
    cow: 2.18,
    tiger: 2.12,
    lion: 2.34,
    dragon: 2.78
  };
  const COSTUMES = [
    {
      key: 'beach',
      label: 'Beach Runner',
      cost: 0,
      palette: {
        skin: '#ffe2c3',
        shirt: '#ff7b66',
        shorts: '#3756c4',
        shoe: '#ffffff',
        hair: '#5b4230',
        face: '#fff7ea',
        accent: '#ffd989',
        dark: '#21415f',
        trim: '#fff0a8'
      }
    },
    {
      key: 'ninja',
      label: 'Ninja',
      cost: 120,
      palette: {
        skin: '#f1d4b6',
        shirt: '#20242d',
        shorts: '#151923',
        shoe: '#10131a',
        hair: '#24201d',
        face: '#f7ddbd',
        accent: '#74d7ff',
        dark: '#0c121c',
        trim: '#6ee7ff'
      }
    },
    {
      key: 'dragon',
      label: 'Dragon Hoodie',
      cost: 180,
      palette: {
        skin: '#ffe1c7',
        shirt: '#6f6cff',
        shorts: '#3d3a9f',
        shoe: '#c7f4ff',
        hair: '#263052',
        face: '#fff0d8',
        accent: '#ffe67b',
        dark: '#171b45',
        trim: '#89dfff'
      }
    },
    {
      key: 'galaxy',
      label: 'Galaxy',
      cost: 620,
      palette: {
        skin: '#f4ddff',
        shirt: '#100825',
        shorts: '#07051a',
        shoe: '#dff8ff',
        hair: '#140b26',
        face: '#fff5ff',
        accent: '#ff5de8',
        dark: '#04020f',
        trim: '#7bf7ff'
      }
    },
    {
      key: 'forest',
      label: 'Forest Scout',
      cost: 150,
      palette: {
        skin: '#f7d4ad',
        shirt: '#36a66a',
        shorts: '#245b42',
        shoe: '#f0e1b0',
        hair: '#6a4528',
        face: '#fff1dc',
        accent: '#b7d868',
        dark: '#173524',
        trim: '#e9f7a1'
      }
    },
    {
      key: 'volcano',
      label: 'Volcano',
      cost: 220,
      palette: {
        skin: '#ffd0b6',
        shirt: '#3a2822',
        shorts: '#231715',
        shoe: '#ffb36b',
        hair: '#321d18',
        face: '#ffe8d4',
        accent: '#ff6337',
        dark: '#160d0b',
        trim: '#ffcf69'
      }
    }
  ];
  const costumeByKey = new Map(COSTUMES.map((costume) => [costume.key, costume]));
  const WEAPONS = [
    { key: 'none', label: 'Hands', cost: 0, range: 0, knockback: 0, color: '#ffffff', blade: '#ffffff' },
    { key: 'wood_sword', label: 'Wood Sword', cost: 75, range: 4.8, knockback: 8, color: '#8a5530', blade: '#d9a35c' },
    { key: 'iron_sword', label: 'Iron Sword', cost: 160, range: 5.4, knockback: 11, color: '#30556d', blade: '#d9eef5' },
    { key: 'storm_sword', label: 'Storm Sword', cost: 260, range: 6.1, knockback: 14, color: '#276d8f', blade: '#7fdcff' },
    { key: 'boss_sword', label: 'Boss Breaker', cost: 420, range: 7.0, knockback: 18, color: '#44151c', blade: '#ff5f4a' },
    { key: 'god_deck_sword', label: 'God Deck Sword', cost: 9999999999999999, range: 12.5, knockback: 42, color: '#150b2b', blade: '#fff36d' }
  ];
  const weaponByKey = new Map(WEAPONS.map((weapon) => [weapon.key, weapon]));
  const petByKey = new Map(PET_TYPES.map((pet) => [pet.key, pet]));
  const managedPetKeys = PET_TYPES.filter((pet) => pet.key !== 'none').map((pet) => pet.key);

  function makeDefaultPetLevels() {
    return Object.fromEntries(managedPetKeys.map((key) => [key, 1]));
  }

  function makeDefaultSave() {
    return {
      name: 'Player',
      profileNameSet: false,
      startBossDragonCheat: true,
      banked: 0,
      speedLevel: 0,
      dashMax: 1.4,
      collection: Array(SAVE_SLOT_COUNT).fill(null),
      cameraMode: 'third',
      costumeKey: 'beach',
      weaponKey: 'none',
      petKey: 'none',
      placedPetKey: null,
      placedPetKeys: Array(HOUSE_PET_DOCK_COUNT).fill(null),
      unlockedPets: ['none'],
      petLevels: makeDefaultPetLevels()
    };
  }

  function normalizeSave(data) {
    const fallback = makeDefaultSave();
    const input = data && typeof data === 'object' ? data : {};
    const legacyPlacedPetKey = petByKey.has(input.placedPetKey) && input.placedPetKey !== 'none' ? input.placedPetKey : null;
    const placedPetKeys = Array.from({ length: HOUSE_PET_DOCK_COUNT }, (_, index) => {
      const value = Array.isArray(input.placedPetKeys) ? input.placedPetKeys[index] : null;
      return petByKey.has(value) && value !== 'none' ? value : null;
    });
    if (!placedPetKeys.some(Boolean) && legacyPlacedPetKey) {
      placedPetKeys[0] = legacyPlacedPetKey;
    }
    const primaryPlacedPetKey = placedPetKeys.find(Boolean) || null;
    return {
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 18) : fallback.name,
      profileNameSet: Boolean(input.profileNameSet),
      startBossDragonCheat: input.startBossDragonCheat !== false,
      banked: Number.isFinite(input.banked) ? Math.max(0, Math.floor(input.banked)) : fallback.banked,
      speedLevel: Number.isFinite(input.speedLevel) ? Math.max(0, Math.floor(input.speedLevel)) : fallback.speedLevel,
      dashMax: Number.isFinite(input.dashMax) ? Math.max(1.4, Number(input.dashMax)) : fallback.dashMax,
      collection: Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => {
        const value = Array.isArray(input.collection) ? input.collection[index] : null;
        return typeof value === 'string' && value ? value : null;
      }),
      cameraMode: CAMERA_MODES.some((mode) => mode.key === input.cameraMode) ? input.cameraMode : fallback.cameraMode,
      costumeKey: costumeByKey.has(input.costumeKey) ? input.costumeKey : fallback.costumeKey,
      weaponKey: weaponByKey.has(input.weaponKey) ? input.weaponKey : fallback.weaponKey,
      petKey: petByKey.has(input.petKey) ? input.petKey : fallback.petKey,
      placedPetKey: primaryPlacedPetKey,
      placedPetKeys,
      unlockedPets: Array.from(new Set(['none', ...(Array.isArray(input.unlockedPets) ? input.unlockedPets.filter((key) => petByKey.has(key)) : [])])),
      petLevels: Object.fromEntries(managedPetKeys.map((key) => {
        const value = input.petLevels && Number.isFinite(input.petLevels[key]) ? Math.max(1, Math.floor(input.petLevels[key])) : fallback.petLevels[key];
        return [key, value];
      }))
    };
  }

  function createStorage() {
    const fallbackKey = 'tsunami-steal-save';
    const fallback = {
      kind: 'localStorage',
      async load() {
        try {
          return normalizeSave(JSON.parse(localStorage.getItem(fallbackKey) || 'null'));
        } catch (error) {
          console.warn('localStorage load failed.', error);
          return makeDefaultSave();
        }
      },
      async save(data) {
        localStorage.setItem(fallbackKey, JSON.stringify(normalizeSave(data)));
      }
    };

    if (!('indexedDB' in window)) return fallback;

    let dbPromise;
    function openDb() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
          const request = indexedDB.open('tsunami-steal-db', 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('profiles')) {
              db.createObjectStore('profiles');
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      return dbPromise;
    }

    return {
      kind: 'IndexedDB',
      async load() {
        const idbLoad = (async () => {
          const db = await openDb();
          const result = await new Promise((resolve, reject) => {
            const tx = db.transaction('profiles', 'readonly');
            const store = tx.objectStore('profiles');
            const request = store.get('primary');
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
          });
          return result ? normalizeSave(result) : fallback.load();
        })();

        const timeoutLoad = new Promise((resolve) => {
          setTimeout(async () => resolve(await fallback.load()), 1200);
        });

        try {
          return await Promise.race([idbLoad, timeoutLoad]);
        } catch (error) {
          console.warn('IndexedDB load failed, using fallback.', error);
          return fallback.load();
        }
      },
      async save(data) {
        const normalized = normalizeSave(data);
        try {
          const db = await openDb();
          await new Promise((resolve, reject) => {
            const tx = db.transaction('profiles', 'readwrite');
            const store = tx.objectStore('profiles');
            store.put(normalized, 'primary');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
        } catch (error) {
          console.warn('IndexedDB save failed, storing fallback copy.', error);
        }
        await fallback.save(normalized);
      }
    };
  }

  const storage = createStorage();
  const saveState = await storage.load();
  if (!Array.isArray(saveState.placedPetKeys)) {
    saveState.placedPetKeys = Array(HOUSE_PET_DOCK_COUNT).fill(null);
  }
  saveState.placedPetKeys = saveState.placedPetKeys.slice(0, HOUSE_PET_DOCK_COUNT);
  while (saveState.placedPetKeys.length < HOUSE_PET_DOCK_COUNT) saveState.placedPetKeys.push(null);
  const displacedShowcasePet = saveState.placedPetKeys[BEST_SHOWCASE_DOCK_INDEX];
  if (displacedShowcasePet) {
    saveState.placedPetKeys[BEST_SHOWCASE_DOCK_INDEX] = null;
    const sideSlot = saveState.placedPetKeys.findIndex((key, index) => index !== BEST_SHOWCASE_DOCK_INDEX && !key);
    if (sideSlot !== -1) {
      saveState.placedPetKeys[sideSlot] = displacedShowcasePet;
    } else if (saveState.petKey === 'none') {
      saveState.petKey = displacedShowcasePet;
    }
  }
  saveState.placedPetKey = saveState.placedPetKeys.find(Boolean) || null;
  if (saveState.petKey !== 'none' && saveState.placedPetKeys.includes(saveState.petKey)) {
    saveState.petKey = 'none';
  }
  saveState.banked = INFINITE_BANKED;

  const ui = {
    bank: document.getElementById('bank'),
    carry: document.getElementById('carry'),
    wave: document.getElementById('wave-timer'),
    speed: document.getElementById('speed'),
    dash: document.getElementById('dash'),
    rivals: document.getElementById('rivals'),
    toast: document.getElementById('toast'),
    objective: document.getElementById('objective'),
    playerName: document.getElementById('player-name'),
    cameraMode: document.getElementById('camera-mode'),
    collectionCount: document.getElementById('collection-count'),
    totalAssets: document.getElementById('total-assets'),
    saveStatus: document.getElementById('save-status'),
    nameInput: document.getElementById('player-name-input'),
    saveNameButton: document.getElementById('save-name-btn'),
    profileCard: document.querySelector('.profile-card'),
    bulkUpgradePanel: document.getElementById('bulk-upgrade-panel'),
    bulkUpgradePet: document.getElementById('bulk-upgrade-pet'),
    bulkUpgradeLevel: document.getElementById('bulk-upgrade-level'),
    bulkUpgradeCost: document.getElementById('bulk-upgrade-cost'),
    bulkUpgradeStatus: document.getElementById('bulk-upgrade-status'),
    bulkUpgradeConfirm: document.getElementById('bulk-upgrade-confirm'),
    bulkUpgradeClose: document.getElementById('bulk-upgrade-close'),
    battlePanel: document.getElementById('battle-panel'),
    battleStatus: document.getElementById('battle-status'),
    battleClose: document.getElementById('battle-close'),
    battleMatch: document.getElementById('battle-match'),
    battleSkills: document.getElementById('battle-skills'),
    battleLog: document.getElementById('battle-log'),
    battlePlayerPet: document.getElementById('battle-player-pet'),
    battleEnemyPet: document.getElementById('battle-enemy-pet'),
    battlePlayerName: document.getElementById('battle-player-name'),
    battleEnemyName: document.getElementById('battle-enemy-name'),
    battlePlayerHp: document.getElementById('battle-player-hp'),
    battleEnemyHp: document.getElementById('battle-enemy-hp'),
    battleImpact: document.getElementById('battle-impact')
  };

  ui.nameInput.value = saveState.name;
  ui.saveStatus.textContent = `Save loaded from ${storage.kind}.`;
  refreshProfileCard();

  const gameState = {
    banked: INFINITE_BANKED,
    rivalBanked: 0,
    nextWave: 17,
    nextDisaster: 12,
    waveCount: 0,
    spawnTimer: 0,
    petSpawnTimer: 0,
    petIncomeBuffer: 0,
    autosaveTimer: 0,
    calmCheckTimer: 0,
    calmOceanTimer: 0,
    toastTimer: 0,
    speedLevel: saveState.speedLevel,
    dashMax: saveState.dashMax,
    dashEnergy: saveState.dashMax,
    cameraModeIndex: Math.max(0, CAMERA_MODES.findIndex((mode) => mode.key === saveState.cameraMode))
  };
  const battleState = {
    open: false,
    playerId: null,
    battleId: null,
    battle: null,
    pollTimer: 0,
    impactTimer: 0
  };

  let saveTimer = null;
  let saveMessageTimer = null;

  function currentCameraMode() {
    return CAMERA_MODES[gameState.cameraModeIndex] || CAMERA_MODES[0];
  }

  function snapshotSave() {
    return normalizeSave({
      name: saveState.name,
      profileNameSet: saveState.profileNameSet,
      startBossDragonCheat: saveState.startBossDragonCheat,
      banked: gameState.banked,
      speedLevel: gameState.speedLevel,
      dashMax: gameState.dashMax,
      collection: saveState.collection.slice(),
      cameraMode: currentCameraMode().key,
      costumeKey: saveState.costumeKey,
      weaponKey: saveState.weaponKey,
      petKey: saveState.petKey,
      placedPetKey: saveState.placedPetKeys.find(Boolean) || null,
      placedPetKeys: saveState.placedPetKeys.slice(0, HOUSE_PET_DOCK_COUNT),
      unlockedPets: saveState.unlockedPets.slice(),
      petLevels: { ...saveState.petLevels }
    });
  }

  function setSaveStatus(message, timeout = 1800) {
    ui.saveStatus.textContent = message;
    if (saveMessageTimer) clearTimeout(saveMessageTimer);
    if (timeout > 0) {
      saveMessageTimer = setTimeout(() => {
        ui.saveStatus.textContent = `Save ready in ${storage.kind}.`;
      }, timeout);
    }
  }

  function refreshProfileCard() {
    const shouldHide = Boolean(saveState.profileNameSet && saveState.name);
    ui.profileCard.classList.toggle('hidden', shouldHide);
  }

  function queueSave(message = 'Saved permanently.') {
    if (saveTimer) clearTimeout(saveTimer);
    ui.saveStatus.textContent = 'Saving...';
    saveTimer = setTimeout(async () => {
      try {
        await storage.save(snapshotSave());
        setSaveStatus(message);
      } catch (error) {
        console.error('Save failed.', error);
        setSaveStatus('Save failed. Progress stays in this tab for now.', 3000);
      }
    }, 180);
  }

  function syncInfiniteBank() {
    gameState.banked = INFINITE_BANKED;
    saveState.banked = INFINITE_BANKED;
  }

  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#7fdcff');
  scene.fog = new THREE.Fog('#9de6ff', 70, 390);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 16, -18);
  const raycaster = new THREE.Raycaster();
  const clickPointer = new THREE.Vector2();

  const ambient = new THREE.AmbientLight('#ffffff', 1.35);
  const hemi = new THREE.HemisphereLight('#d8fff8', '#30a6c8', 1.0);
  const sun = new THREE.DirectionalLight('#fff8d0', 1.35);
  sun.position.set(-26, 44, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  scene.add(ambient, hemi, sun);

  const WORLD = {
    laneWidth: 32 * LANE_SCALE,
    homeWidth: 58,
    homeDepth: 34,
    spawnScale: 4,
    spawnWidth: 58 * 4,
    spawnDepth: (34 + 10) * 4,
    spawnFrontZ: 34 + 3,
    length: 34 + (INITIAL_SECTION_COUNT * (SECTION_LENGTH + GAP_LENGTH)) + 34,
    maxLoot: 18
  };
  WORLD.spawnBackZ = WORLD.spawnFrontZ - WORLD.spawnDepth;
  WORLD.spawnCenterZ = (WORLD.spawnFrontZ + WORLD.spawnBackZ) / 2;
  scene.fog.far = WORLD.length + 130;

  function createSectionData(index) {
    const zeroIndex = index - 1;
    // Clamp at the final rarity, so every section past Galaxy continues as Boss.
    const tierIndex = Math.min(RARITY_TIERS.length - 1, Math.floor(zeroIndex / SECTIONS_PER_TIER));
    const tier = RARITY_TIERS[tierIndex];
    const start = WORLD.homeDepth + 10 + zeroIndex * (SECTION_LENGTH + GAP_LENGTH);
    const end = start + SECTION_LENGTH;
    return {
      index,
      tier,
      tierIndex,
      start,
      end,
      center: (start + end) / 2
    };
  }

  function createGapData(previousSection, nextSection, index) {
    return {
      index,
      start: previousSection.end + 1,
      end: nextSection.start - 1,
      center: (previousSection.end + nextSection.start) / 2,
      shelterMinX: 10.9 * LANE_SCALE
    };
  }

  const sections = [];
  const SECTION_GAPS = [];

  function appendSectionData() {
    const section = createSectionData(sections.length + 1);
    const previous = sections[sections.length - 1];
    sections.push(section);
    if (previous) {
      SECTION_GAPS.push(createGapData(previous, section, SECTION_GAPS.length + 1));
    }
    WORLD.length = Math.max(WORLD.length, section.end + 34);
    scene.fog.far = Math.max(scene.fog.far, section.end + 220);
    return section;
  }

  for (let i = 0; i < INITIAL_SECTION_COUNT; i++) appendSectionData();

  const lootRarities = RARITY_TIERS;
  const rarityByKey = new Map(RARITY_TIERS.map((rarity) => [rarity.key, rarity]));

  const input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false
  };
  const justPressed = new Set();
  const viewState = {
    yaw: 0,
    pitch: -0.18,
    locked: false
  };

  function getSectionForZ(z) {
    return sections.find((section) => z >= section.start && z <= section.end) || null;
  }

  function getGapZone(z) {
    return SECTION_GAPS.find((gap) => z >= gap.start && z <= gap.end) || null;
  }

  function getGapState(position) {
    const gap = getGapZone(position.z);
    if (!gap) {
      return {
        gap: null,
        inPit: false,
        inShelter: false
      };
    }
    const absX = Math.abs(position.x);
    return {
      gap,
      inPit: absX < gap.shelterMinX - 0.65,
      inShelter: absX >= gap.shelterMinX
    };
  }

  function getActorGroundY(actor) {
    const gapState = getGapState(actor.group.position);
    return gapState.inPit ? actor.baseY - GAP_PIT_DROP : actor.baseY;
  }

  function getActivePet() {
    return petByKey.get(saveState.petKey) || petByKey.get('none');
  }

  function syncPlacedPetLegacyKey() {
    saveState.placedPetKey = saveState.placedPetKeys.find(Boolean) || null;
  }

  function clearPlacedPetKey(petKey) {
    let changed = false;
    saveState.placedPetKeys = saveState.placedPetKeys.map((key) => {
      if (key !== petKey) return key;
      changed = true;
      return null;
    });
    if (changed) syncPlacedPetLegacyKey();
    return changed;
  }

  function getPlacedPet(index = 0) {
    return petByKey.get(saveState.placedPetKeys[index]) || petByKey.get('none');
  }

  function getBestOwnedPetKey() {
    const owned = saveState.unlockedPets.filter((key) => key && key !== 'none' && petByKey.has(key));
    if (!owned.length) return 'none';
    return owned.sort((leftKey, rightKey) => {
      const leftLevel = getPetLevel(leftKey);
      const rightLevel = getPetLevel(rightKey);
      const leftIncome = getPetIncomePerSecond(leftKey, leftLevel);
      const rightIncome = getPetIncomePerSecond(rightKey, rightLevel);
      if (leftIncome !== rightIncome) return rightIncome - leftIncome;
      if (leftLevel !== rightLevel) return rightLevel - leftLevel;
      return (RARITY_INDEX.get(petByKey.get(rightKey).minTier) ?? 0) - (RARITY_INDEX.get(petByKey.get(leftKey).minTier) ?? 0);
    })[0];
  }

  function getBestOwnedPet() {
    return petByKey.get(getBestOwnedPetKey()) || petByKey.get('none');
  }

  function isActivePetPlaced() {
    return saveState.petKey !== 'none' && saveState.placedPetKeys.includes(saveState.petKey);
  }

  function getPetLevel(petKey = saveState.petKey) {
    if (!petKey || petKey === 'none') return 0;
    return Math.max(1, saveState.petLevels[petKey] || 1);
  }

  function getPetIncomeMultiplier(level) {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    const multiplier = 2 ** Math.min(1023, safeLevel - 1);
    return Number.isFinite(multiplier) ? multiplier : Number.MAX_VALUE;
  }

  function getPetIncomePerSecond(petKey = saveState.petKey, level = getPetLevel(petKey)) {
    const pet = petByKey.get(petKey) || petByKey.get('none');
    const income = pet.incomePerSecond * getPetIncomeMultiplier(level);
    if (!Number.isFinite(income) || income >= INCOME_INFINITY_THRESHOLD) return INCOME_INFINITY_THRESHOLD;
    return Math.round(income);
  }

  function formatPetIncome(income) {
    if (!Number.isFinite(income) || income >= INCOME_INFINITY_THRESHOLD) return 'Infinity';
    return `${Math.round(income)}`;
  }

  function getPetUpgradeCost(petKey = saveState.petKey, level = getPetLevel(petKey)) {
    const pet = petByKey.get(petKey) || petByKey.get('none');
    if (pet.key === 'none') return 0;
    return Math.round(pet.upgradeBaseCost * (1 + (level - 1) * 1.45));
  }

  function getPetSellValue(petKey = saveState.petKey, level = getPetLevel(petKey)) {
    return Math.round(getPetIncomePerSecond(petKey, level) * 10);
  }

  function getBulkUpgradeCost(petKey, targetLevel) {
    if (FREE_CHEAT_UPGRADES) return 0;
    const currentLevel = getPetLevel(petKey);
    if (!petKey || petKey === 'none' || targetLevel <= currentLevel) return 0;
    const pet = petByKey.get(petKey) || petByKey.get('none');
    const steps = targetLevel - currentLevel;
    if (steps > 5000) {
      const first = pet.upgradeBaseCost * (1 + (currentLevel - 1) * 1.45);
      const last = pet.upgradeBaseCost * (1 + (targetLevel - 2) * 1.45);
      return Math.round((steps * (first + last)) / 2);
    }
    let total = 0;
    for (let level = currentLevel; level < targetLevel; level++) {
      total += getPetUpgradeCost(petKey, level);
    }
    return total;
  }

  function getTotalAssets() {
    const petAssets = Array.from(new Set(saveState.unlockedPets))
      .filter((petKey) => petKey && petKey !== 'none')
      .reduce((sum, petKey) => sum + getPetSellValue(petKey, getPetLevel(petKey)), 0);
    return gameState.banked + petAssets;
  }

  function petEligibleForTier(pet, tierKey) {
    return (RARITY_INDEX.get(tierKey) ?? 0) >= (RARITY_INDEX.get(pet.minTier) ?? 0);
  }

  function nextTierLabel(section) {
    return section ? `${section.tier.label} Section ${section.index}` : 'Home';
  }

  function getPetRarityLabel(petKey) {
    const pet = petByKey.get(petKey) || petByKey.get('none');
    if (pet.key === 'none') return 'None';
    const tier = RARITY_TIERS.find((entry) => entry.key === pet.minTier);
    return tier ? tier.label : pet.minTier;
  }

  function lockPointer() {
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
  }

  function resetMovementInput() {
    input.forward = false;
    input.back = false;
    input.left = false;
    input.right = false;
    input.sprint = false;
    justPressed.delete('Jump');
  }

  function isBulkUpgradeOpen() {
    return ui.bulkUpgradePanel.classList.contains('open');
  }

  function resolvePetInput(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    const compact = normalized.replace(/\s+/g, '');
    return PET_TYPES.find((pet) => {
      if (pet.key === 'none') return false;
      const key = pet.key.toLowerCase();
      const label = pet.label.toLowerCase().replace(/\s+/g, '');
      return key === normalized || label === compact || normalized.includes(key) || compact.includes(label);
    }) || null;
  }

  function refreshBulkUpgradePanel() {
    const pet = resolvePetInput(ui.bulkUpgradePet.value);
    const targetLevel = Math.max(1, Math.floor(Number(ui.bulkUpgradeLevel.value) || 1));
    ui.bulkUpgradeLevel.value = `${targetLevel}`;

    if (!pet) {
      ui.bulkUpgradeCost.textContent = 'Cost: 0';
      ui.bulkUpgradeStatus.textContent = 'Type a pet name like dragon, cow, tiger, lion, deer, frog, or even boss dragon.';
      return { pet: null, targetLevel, cost: 0 };
    }

    const currentLevel = getPetLevel(pet.key);
    const cost = getBulkUpgradeCost(pet.key, targetLevel);
    ui.bulkUpgradeCost.textContent = `Cost: ${cost}`;
    ui.bulkUpgradeStatus.textContent = !saveState.unlockedPets.includes(pet.key)
      ? `${pet.label} is not unlocked yet, but this cheat panel will unlock and boost it instantly.`
      : targetLevel <= currentLevel
      ? `${pet.label} is already Lv.${currentLevel} or higher.`
      : FREE_CHEAT_UPGRADES
        ? `${pet.label} will go from Lv.${currentLevel} to Lv.${targetLevel} for free. No max level cap.`
        : `${pet.label} will go from Lv.${currentLevel} to Lv.${targetLevel}. No max level cap.`;
    return { pet, targetLevel, cost };
  }

  function toggleBulkUpgradePanel(forceOpen = !isBulkUpgradeOpen()) {
    const open = Boolean(forceOpen);
    ui.bulkUpgradePanel.classList.toggle('open', open);
    ui.bulkUpgradePanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      resetMovementInput();
      if (document.pointerLockElement === canvas && document.exitPointerLock) {
        document.exitPointerLock();
      }
      refreshBulkUpgradePanel();
      setTimeout(() => ui.bulkUpgradePet.focus(), 0);
    } else {
      ui.bulkUpgradePet.blur();
      ui.bulkUpgradeLevel.blur();
    }
  }

  function confirmBulkUpgrade() {
    const { pet, targetLevel, cost } = refreshBulkUpgradePanel();
    if (!pet) {
      ui.bulkUpgradeStatus.textContent = 'That pet name was not recognized.';
      showToast('Type a valid pet name first.');
      return;
    }
    if (!saveState.unlockedPets.includes(pet.key)) {
      saveState.unlockedPets.push(pet.key);
    }
    saveState.petLevels[pet.key] = Math.max(1, saveState.petLevels[pet.key] || 1);
    const currentLevel = getPetLevel(pet.key);
    if (targetLevel <= currentLevel) {
      ui.bulkUpgradeStatus.textContent = `${pet.label} is already at Lv.${currentLevel}.`;
      showToast(`${pet.label} is already at Lv.${currentLevel}.`);
      return;
    }
    if (!FREE_CHEAT_UPGRADES && gameState.banked < cost) {
      ui.bulkUpgradeStatus.textContent = `You need ${cost} banked to boost ${pet.label} that far.`;
      showToast(`You need ${cost} banked to boost ${pet.label} that far.`);
      return;
    }
    if (!FREE_CHEAT_UPGRADES) {
      gameState.banked -= cost;
    }
    saveState.petLevels[pet.key] = targetLevel;
    mountActivePet();
    queueSave(`${pet.label} bulk level saved.`);
    refreshBulkUpgradePanel();
    ui.bulkUpgradeStatus.textContent = `${pet.label} reached Lv.${targetLevel}.`;
    showToast(
      FREE_CHEAT_UPGRADES
        ? `${pet.label} cheated straight to Lv.${targetLevel} for free.`
        : `${pet.label} jumped straight to Lv.${targetLevel}.`
    );
    toggleBulkUpgradePanel(false);
  }

  function getBattleSkills(petKey) {
    return PET_BATTLE_SKILLS[petKey] || PET_BATTLE_SKILLS.frog;
  }

  function getBattleDamage(petKey, level, skill) {
    const rarityBonus = RARITY_INDEX.get((petByKey.get(petKey) || petByKey.get('frog')).minTier) || 0;
    return Math.round(skill.power + level * skill.scale + rarityBonus * 8);
  }

  function petInitial(petKey) {
    const pet = petByKey.get(petKey) || petByKey.get('none');
    return pet.key === 'none' ? '?' : pet.label.slice(0, 1).toUpperCase();
  }

  function isBattleOpen() {
    return ui.battlePanel.classList.contains('open');
  }

  function setBattlePanel(open) {
    battleState.open = open;
    ui.battlePanel.classList.toggle('open', open);
    ui.battlePanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      resetMovementInput();
      if (document.pointerLockElement === canvas && document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
  }

  function getBattlePayload() {
    let pet = getBestOwnedPet();
    if (pet.key === 'none') {
      pet = petByKey.get('frog');
      if (!saveState.unlockedPets.includes('frog')) saveState.unlockedPets.push('frog');
    }
    return {
      name: saveState.name || 'Player',
      petKey: pet.key,
      petLabel: pet.label,
      level: getPetLevel(pet.key)
    };
  }

  function renderBattleSkills() {
    const pet = getBattlePayload();
    const skills = getBattleSkills(pet.petKey);
    ui.battleSkills.innerHTML = '';
    for (const [index, skill] of skills.entries()) {
      const button = document.createElement('button');
      button.className = 'battle-skill';
      button.type = 'button';
      button.textContent = `${skill.name} (${getBattleDamage(pet.petKey, pet.level, skill)})`;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        useBattleSkill(index);
      });
      ui.battleSkills.appendChild(button);
    }
  }

  function renderBattle(battle) {
    battleState.battle = battle;
    const player = battle.players.find((entry) => entry.id === battleState.playerId) || battle.players[0];
    const enemy = battle.players.find((entry) => entry.id !== player.id) || battle.players[1] || player;
    const playerHp = battle.hp[player.id] ?? 0;
    const enemyHp = battle.hp[enemy.id] ?? 0;
    const playerMax = battle.maxHp[player.id] || 1;
    const enemyMax = battle.maxHp[enemy.id] || 1;
    const yourTurn = battle.turn === player.id && !battle.winner;

    ui.battlePlayerPet.textContent = petInitial(player.petKey);
    ui.battleEnemyPet.textContent = petInitial(enemy.petKey);
    ui.battlePlayerName.textContent = `${player.name} - ${player.petLabel} Lv.${player.level}`;
    ui.battleEnemyName.textContent = `${enemy.name} - ${enemy.petLabel} Lv.${enemy.level}`;
    ui.battlePlayerHp.style.width = `${Math.max(0, (playerHp / playerMax) * 100)}%`;
    ui.battleEnemyHp.style.width = `${Math.max(0, (enemyHp / enemyMax) * 100)}%`;
    ui.battleLog.textContent = battle.log.join('  |  ');
    ui.battleStatus.textContent = battle.winner
      ? battle.winner === player.id ? 'You won the pet battle' : 'Your pet lost this round'
      : yourTurn ? 'Your turn - choose a skill' : 'Waiting for opponent';

    for (const button of ui.battleSkills.querySelectorAll('button')) {
      button.disabled = !yourTurn;
    }
  }

  function playBattleImpact(playerAttacked = true) {
    const attacker = playerAttacked ? document.querySelector('.player-fighter') : document.querySelector('.enemy-fighter');
    const defender = playerAttacked ? document.querySelector('.enemy-fighter') : document.querySelector('.player-fighter');
    ui.battleImpact.classList.remove('hit');
    attacker.classList.remove('attack');
    defender.classList.remove('hurt');
    void ui.battleImpact.offsetWidth;
    ui.battleImpact.classList.add('hit');
    attacker.classList.add('attack');
    defender.classList.add('hurt');
    battleState.impactTimer = 0.42;
    if (activePetMesh) {
      activePetMesh.scale.setScalar(1.22);
    }
  }

  async function pollBattle() {
    if (!battleState.battleId) return;
    try {
      const response = await fetch(`/api/battle?battleId=${encodeURIComponent(battleState.battleId)}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.battle) renderBattle(data.battle);
    } catch (error) {
      ui.battleStatus.textContent = 'Battle server not reachable.';
    }
  }

  async function pollMatch() {
    if (!battleState.playerId || battleState.battleId) return;
    try {
      const response = await fetch(`/api/match?playerId=${encodeURIComponent(battleState.playerId)}`);
      const data = await response.json();
      if (data.status === 'matched') {
        battleState.battleId = data.battle.battleId;
        ui.battleMatch.textContent = 'Find Another Match';
        ui.battleStatus.textContent = 'Matched - battle started';
        renderBattleSkills();
        renderBattle(data.battle);
      } else {
        ui.battleStatus.textContent = 'Matching online players... bot joins after 5 seconds';
      }
    } catch (error) {
      ui.battleStatus.textContent = 'Open with play.bat to use matchmaking.';
    }
  }

  async function startPetBattleMatch() {
    setBattlePanel(true);
    battleState.playerId = null;
    battleState.battleId = null;
    battleState.battle = null;
    renderBattleSkills();
    const payload = getBattlePayload();
    ui.battleStatus.textContent = `Matching with ${payload.petLabel} Lv.${payload.level}...`;
    ui.battlePlayerPet.textContent = petInitial(payload.petKey);
    ui.battlePlayerName.textContent = `${payload.name} - ${payload.petLabel} Lv.${payload.level}`;
    ui.battleEnemyPet.textContent = '?';
    ui.battleEnemyName.textContent = 'Searching...';
    ui.battlePlayerHp.style.width = '100%';
    ui.battleEnemyHp.style.width = '100%';
    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      battleState.playerId = data.playerId;
      if (data.status === 'matched') {
        battleState.battleId = data.battle.battleId;
        renderBattle(data.battle);
      } else {
        ui.battleStatus.textContent = 'Matching online players...';
      }
    } catch (error) {
      ui.battleStatus.textContent = 'Matchmaking needs play.bat server.';
      ui.battleLog.textContent = 'Could not reach /api/match. Launch the game through play.bat.';
    }
  }

  async function useBattleSkill(index) {
    if (!battleState.battle || !battleState.battleId || !battleState.playerId) return;
    if (battleState.battle.turn !== battleState.playerId || battleState.battle.winner) return;
    const payload = getBattlePayload();
    const skill = getBattleSkills(payload.petKey)[index] || getBattleSkills(payload.petKey)[0];
    const damage = getBattleDamage(payload.petKey, payload.level, skill);
    playBattleImpact(true);
    try {
      const response = await fetch('/api/battle/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId: battleState.battleId,
          playerId: battleState.playerId,
          skillName: skill.name,
          damage
        })
      });
      const data = await response.json();
      if (data.battle) renderBattle(data.battle);
    } catch (error) {
      ui.battleStatus.textContent = 'Could not send battle move.';
    }
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.style.opacity = '1';
    gameState.toastTimer = 2.4;
  }

  function cycleCameraMode() {
    gameState.cameraModeIndex = (gameState.cameraModeIndex + 1) % CAMERA_MODES.length;
    showToast(`Camera switched to ${currentCameraMode().label} view.`);
    queueSave('Camera preference saved.');
  }

  function resetSpeedUpgrades() {
    const refunded = gameState.speedLevel * SPEED_UPGRADE_COST;
    if (gameState.speedLevel <= 0) {
      showToast('Speed is already reset. No speed coins to refund.');
      return;
    }
    gameState.speedLevel = 0;
    gameState.banked += refunded;
    saveState.banked = gameState.banked;
    queueSave('Speed reset saved.');
    showToast(`Speed reset to base. Refunded ${refunded} coins at 100%.`);
  }

  window.addEventListener('keydown', (event) => {
    if (isBattleOpen()) {
      if (event.code === 'KeyB' && !event.repeat) setBattlePanel(false);
      if (event.code === 'Escape') setBattlePanel(false);
      return;
    }
    if (isBulkUpgradeOpen()) {
      const typingInField = event.target === ui.bulkUpgradePet || event.target === ui.bulkUpgradeLevel;
      if (event.code === 'KeyG' && !event.repeat && !typingInField) {
        toggleBulkUpgradePanel(false);
      } else if (event.code === 'Escape') {
        toggleBulkUpgradePanel(false);
      }
      return;
    }
    if ((event.code === 'Space' || event.code.startsWith('Arrow')) && document.pointerLockElement === canvas) {
      event.preventDefault();
    }
    if (event.code === 'KeyW' || event.code === 'ArrowUp') input.forward = true;
    if (event.code === 'KeyS' || event.code === 'ArrowDown') input.back = true;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') input.left = true;
    if (event.code === 'KeyD' || event.code === 'ArrowRight') input.right = true;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.sprint = true;
    if (event.code === 'Space' && !event.repeat) justPressed.add('Jump');
    if (event.code === 'KeyE' && !event.repeat) justPressed.add('E');
    if (event.code === 'KeyF' && !event.repeat) justPressed.add('F');
    if (event.code === 'KeyG' && !event.repeat) toggleBulkUpgradePanel(true);
    if (event.code === 'KeyB' && !event.repeat) {
      setBattlePanel(true);
      if (!battleState.battleId) startPetBattleMatch();
    }
    if (event.code === 'KeyI' && !event.repeat) resetSpeedUpgrades();
    if (event.code === 'KeyP' && !event.repeat) cycleCameraMode();
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'KeyW' || event.code === 'ArrowUp') input.forward = false;
    if (event.code === 'KeyS' || event.code === 'ArrowDown') input.back = false;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') input.left = false;
    if (event.code === 'KeyD' || event.code === 'ArrowRight') input.right = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.sprint = false;
  });

  function prepareClickRay(event = null) {
    if (!event || document.pointerLockElement === canvas) {
      clickPointer.set(0, 0);
    } else {
      const rect = canvas.getBoundingClientRect();
      clickPointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
    }
    raycaster.setFromCamera(clickPointer, camera);
  }

  function handleWorldClick(event = null) {
    if (!clickablePetButtons.length) return false;
    prepareClickRay(event);
    const activeEntries = clickablePetButtons.filter((entry) => entry.mesh.visible);
    const hits = raycaster.intersectObjects(activeEntries.map((entry) => entry.mesh), false);
    if (!hits.length) return false;
    const target = activeEntries.find((entry) => entry.mesh === hits[0].object);
    if (!target) return false;
    const anchor = target.anchor || petStation.group;
    const interactionRange = target.range || 10;
    if (player.group.position.distanceTo(anchor.position) > interactionRange) {
      showToast('Head back home before managing your pet.');
      return true;
    }
    if (target.kind === 'home-place') {
      placeActivePetOnHomeDock(target.index || 0);
    } else if (target.kind === 'place') {
      placeActivePetOnStation();
    } else if (target.kind === 'upgrade') {
      upgradeActivePet();
    } else if (target.kind === 'sell') {
      sellActivePet();
    } else if (target.kind === 'sell-loot') {
      sellHouseLootSlot(target.index);
    }
    return true;
  }

  function handleEnvironmentClick(event = null) {
    const activeEntries = environmentInteractives.filter((entry) => entry.target.visible);
    if (!activeEntries.length) return false;
    prepareClickRay(event);
    const hits = raycaster.intersectObjects(activeEntries.map((entry) => entry.target), false);
    if (!hits.length) return false;
    const target = activeEntries.find((entry) => entry.target === hits[0].object);
    if (!target || player.group.position.distanceTo(target.group.position) > target.range) return false;
    target.cooldown = 1.2;
    target.pulse = 1;
    showToast(target.message);
    return true;
  }

  function performWeaponAttack() {
    const weapon = weaponByKey.get(saveState.weaponKey) || weaponByKey.get('none');
    if (weapon.key === 'none') {
      showToast('Buy a sword from the weapon shop first.');
      return true;
    }
    if (player.weaponCooldown > 0) return true;

    player.weaponCooldown = 0.55;
    player.attackTimer = 0.26;

    const forward = new THREE.Vector3(Math.sin(viewState.yaw), 0, Math.cos(viewState.yaw));
    let best = null;
    let bestScore = -Infinity;
    for (const bot of bots) {
      const offset = bot.group.position.clone().sub(player.group.position).setY(0);
      const dist = offset.length();
      if (dist <= 0.01 || dist > weapon.range) continue;
      const facing = offset.normalize().dot(forward);
      if (facing < 0.18) continue;
      const score = facing * 10 - dist;
      if (score > bestScore) {
        bestScore = score;
        best = bot;
      }
    }

    if (!best) {
      showToast(`${weapon.label} missed. Get closer and face a rival.`);
      return true;
    }

    const shove = best.group.position.clone().sub(player.group.position).setY(0).normalize().multiplyScalar(weapon.knockback);
    best.velocity.add(shove);
    best.stun = Math.max(best.stun, 0.7);

    if (best.carryingPet) {
      const petLabel = best.carryingPet.pet.label;
      dropCarriedPet(best, `${weapon.label} hit ${best.name}. They dropped ${petLabel}.`);
      if (weapon.key === 'god_deck_sword') {
        for (const extra of bots) {
          if (extra !== best && extra.carryingPet && extra.group.position.distanceTo(player.group.position) < weapon.range * 0.8) {
            dropCarriedPet(extra, `${weapon.label} shockwave forced ${extra.name} to drop a pet too.`);
          }
        }
      }
      return true;
    }

    if (best.carrying) {
      const rarity = best.carrying;
      if (!player.carrying) {
        setCarry(player, rarity);
        setCarry(best, null);
        showToast(`${weapon.label} stole ${rarity.key} loot from ${best.name}.`);
      } else {
        dropCarriedLoot(best, `${weapon.label} knocked ${rarity.key} loot out of ${best.name}.`);
      }
      return true;
    }

    showToast(`${weapon.label} hit ${best.name}, but they were carrying nothing.`);
    return true;
  }

  canvas.addEventListener('click', (event) => {
    if (handleWorldClick(event)) return;
    if (handleEnvironmentClick(event)) return;
    if (buyShopUpgrade(activeShopTarget)) return;
    if (document.pointerLockElement === canvas && performWeaponAttack()) return;
    lockPointer();
  });

  document.addEventListener('pointerlockchange', () => {
    viewState.locked = document.pointerLockElement === canvas;
    if (!viewState.locked) {
      showToast('Mouse released. Click the game to lock the camera again.');
    }
  });

  document.addEventListener('mousemove', (event) => {
    if (!viewState.locked) return;
    viewState.yaw -= event.movementX * 0.0026;
    viewState.pitch = THREE.MathUtils.clamp(viewState.pitch - event.movementY * 0.0019, -0.95, 0.7);
  });

  const clock = new THREE.Clock();
  const oceanMaterial = new THREE.MeshPhongMaterial({
    color: '#36c5ff',
    emissive: '#21a7e4',
    emissiveIntensity: 0.2,
    shininess: 90,
    transparent: true,
    opacity: 0.95
  });

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(620, 620, 64, 64), oceanMaterial);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -2.2;
  scene.add(ocean);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const boardMaterials = {
    home: new THREE.MeshToonMaterial({ color: '#8ef0d0' }),
    trim: new THREE.MeshToonMaterial({ color: '#d79037' }),
    wall: new THREE.MeshToonMaterial({ color: '#ffd08a' }),
    path: RARITY_TIERS.map((tier) => new THREE.MeshToonMaterial({ color: tier.color }))
  };
  const tierTileMaterial = new Map(RARITY_TIERS.map((tier) => [tier.key, new THREE.MeshToonMaterial({ color: tier.color })]));
  const pathPatchMaterials = RARITY_TIERS.map((tier) => {
    const color = new THREE.Color(tier.color).offsetHSL(0, -0.08, 0.08);
    return new THREE.MeshToonMaterial({ color });
  });
  const pathCrackMaterials = RARITY_TIERS.map((tier) => {
    const color = new THREE.Color(tier.color).offsetHSL(0.01, -0.22, -0.32);
    return new THREE.MeshToonMaterial({ color });
  });

  function addBlock(x, y, z, w, h, d, material, target = worldGroup) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    target.add(mesh);
    return mesh;
  }

  addBlock(0, -0.5, WORLD.spawnCenterZ, WORLD.spawnWidth, 1.1, WORLD.spawnDepth, boardMaterials.home);

  function sectionNoise(seed) {
    const raw = Math.sin(seed * 12.9898) * 43758.5453;
    return raw - Math.floor(raw);
  }

  function addSectionCrack(section, x, z, w, d, rotationY = 0) {
    const material = pathCrackMaterials[Math.min(pathCrackMaterials.length - 1, section.tierIndex)];
    const mesh = addBlock(x, 0.36, z, w, 0.08, d, material);
    mesh.rotation.y = rotationY;
    return mesh;
  }

  const renderedSections = new Set();
  const renderedGaps = new Set();

  function renderSection(section) {
    if (renderedSections.has(section.index)) return;
    const materialIndex = Math.min(boardMaterials.path.length - 1, section.tierIndex % boardMaterials.path.length);
    const slabMaterial = boardMaterials.path[materialIndex];
    const patchMaterial = pathPatchMaterials[materialIndex];
    const slabWidth = WORLD.laneWidth - 4.2;
    addBlock(0, -0.08, section.center, slabWidth, 0.98, SECTION_LENGTH + 0.8, slabMaterial);

    const patch1X = THREE.MathUtils.lerp(-5.8, 6.2, sectionNoise(section.index * 1.17));
    const patch1Z = THREE.MathUtils.lerp(section.start + 2.6, section.end - 2.6, sectionNoise(section.index * 2.03));
    const patch1W = THREE.MathUtils.lerp(6.6, 9.8, sectionNoise(section.index * 2.83));
    const patch1D = THREE.MathUtils.lerp(3.1, 5.6, sectionNoise(section.index * 3.61));
    addBlock(patch1X, 0.22, patch1Z, patch1W, 0.14, patch1D, patchMaterial);

    if (section.index % 2 === 0) {
      const patch2X = THREE.MathUtils.lerp(-8.0, 7.4, sectionNoise(section.index * 4.19));
      const patch2Z = THREE.MathUtils.lerp(section.start + 2.4, section.end - 2.4, sectionNoise(section.index * 5.47));
      addBlock(patch2X, 0.18, patch2Z, 5.4, 0.12, 2.6, patchMaterial);
    }

    if (section.index % 3 !== 0) {
      const crackX = THREE.MathUtils.lerp(-5.2, 5.2, sectionNoise(section.index * 7.31));
      const crackZ = THREE.MathUtils.lerp(section.start + 2.3, section.end - 2.3, sectionNoise(section.index * 8.13));
      addSectionCrack(section, crackX, crackZ, 0.34, THREE.MathUtils.lerp(2.2, 4.4, sectionNoise(section.index * 8.91)), THREE.MathUtils.lerp(-0.16, 0.16, sectionNoise(section.index * 9.41)));
    }

    if (section.index % 5 === 0) {
      const crackX = THREE.MathUtils.lerp(-8.4, 8.4, sectionNoise(section.index * 10.07));
      const crackZ = THREE.MathUtils.lerp(section.start + 1.9, section.end - 1.9, sectionNoise(section.index * 10.77));
      addSectionCrack(section, crackX, crackZ, 0.28, 2.5, THREE.MathUtils.lerp(-0.32, 0.32, sectionNoise(section.index * 11.33)));
    }
    addBlock(-WORLD.laneWidth / 2 - 2.2, 2.8, section.center, 1.4, 6.2, SECTION_LENGTH + 1.2, boardMaterials.wall);
    addBlock(WORLD.laneWidth / 2 + 2.2, 2.8, section.center, 1.4, 6.2, SECTION_LENGTH + 1.2, boardMaterials.wall);
    renderedSections.add(section.index);
  }

  const pitFloorMaterial = new THREE.MeshToonMaterial({ color: '#89d2e6' });
  const pitWallMaterial = new THREE.MeshToonMaterial({ color: '#d9f7ff' });
  function renderGap(gap) {
    if (renderedGaps.has(gap.index)) return;
    const gapCenter = (gap.start + gap.end) / 2;
    const gapDepth = gap.end - gap.start + 6;
    addBlock(0, -1.4, gapCenter, gap.shelterMinX * 1.86, 0.68, gapDepth - 0.8, pitFloorMaterial);
    addBlock(gap.shelterMinX - 0.28, -0.56, gapCenter, 0.55, 1.68, gapDepth - 0.2, pitWallMaterial);
    addBlock(-(gap.shelterMinX - 0.28), -0.56, gapCenter, 0.55, 1.68, gapDepth - 0.2, pitWallMaterial);
    renderedGaps.add(gap.index);
  }

  function renderTierMarker(section) {
    if ((section.index - 1) % SECTIONS_PER_TIER !== 0) return;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.8, 1.4),
      new THREE.MeshToonMaterial({ color: section.tier.color })
    );
    marker.position.set(WORLD.laneWidth / 2 + 4.4, 1.4, section.center);
    scene.add(marker);
  }

  for (const section of sections) {
    renderSection(section);
    renderTierMarker(section);
  }
  for (const gap of SECTION_GAPS) renderGap(gap);

  function ensureSectionsAhead(z) {
    const targetZ = z + SECTION_RENDER_AHEAD * (SECTION_LENGTH + GAP_LENGTH);
    while (sections[sections.length - 1].end < targetZ) {
      const previousGapCount = SECTION_GAPS.length;
      const section = appendSectionData();
      const gap = SECTION_GAPS[previousGapCount] || null;
      if (gap) renderGap(gap);
      renderSection(section);
      renderTierMarker(section);
    }
    renderPalmsUntil(WORLD.length);
    renderVolcanoesUntil(WORLD.length);
  }

  addBlock(-WORLD.laneWidth / 2 - 2.2, 2.8, (WORLD.length + WORLD.homeDepth) / 2 + 8, 1.4, 6.2, WORLD.length - WORLD.homeDepth + 16, boardMaterials.wall);
  addBlock(WORLD.laneWidth / 2 + 2.2, 2.8, (WORLD.length + WORLD.homeDepth) / 2 + 8, 1.4, 6.2, WORLD.length - WORLD.homeDepth + 16, boardMaterials.wall);

  function buildCloud(x, y, z, scale) {
    const cloud = new THREE.Group();
    const puffMaterial = new THREE.MeshToonMaterial({ color: '#f9ffff' });
    const puffs = [
      [-2.0, 0.0, 0.0, 3.5],
      [0.1, 0.5, 0.7, 4.0],
      [2.1, 0.0, -0.1, 3.6]
    ];
    for (const [px, py, pz, size] of puffs) {
      const puff = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.9, size), puffMaterial);
      puff.position.set(px, py, pz);
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    scene.add(cloud);
    return cloud;
  }

  const clouds = [
    buildCloud(-38, 22, 22, 1),
    buildCloud(36, 20, 70, 0.9),
    buildCloud(-26, 21, 148, 1.1),
    buildCloud(44, 18, 224, 0.85)
  ];

  const palmMaterial = new THREE.MeshToonMaterial({ color: '#42cb6d' });
  const trunkMaterial = new THREE.MeshToonMaterial({ color: '#9f6631' });
  let palmsRenderedUntil = WORLD.homeDepth + 8;
  let palmPatchIndex = 0;
  function buildPalm(x, z, scale = 1, lean = 0) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.25, 7.4, 1.25), trunkMaterial);
    trunk.position.y = 3.7;
    trunk.rotation.z = lean;
    palm.add(trunk);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 6.4), palmMaterial);
      leaf.position.set(0, 7.1, 0);
      leaf.rotation.y = i * Math.PI / 2 + lean * 1.7;
      leaf.rotation.x = -0.52;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    palm.scale.setScalar(scale);
    scene.add(palm);
  }

  function renderPalmsUntil(limitZ) {
    let z = palmsRenderedUntil;
    while (z < limitZ) {
      const n = sectionNoise(80 + palmPatchIndex * 1.73);
      const sideMode = sectionNoise(130 + palmPatchIndex * 2.11);
      const sides = sideMode < 0.18 ? [] : sideMode < 0.62 ? [-1] : sideMode < 0.9 ? [1] : [-1, 1];
      for (const side of sides) {
        const lateral = THREE.MathUtils.lerp(WORLD.laneWidth * 0.33, WORLD.laneWidth * 0.48, sectionNoise(210 + palmPatchIndex * 3.91 + side));
        const x = side * lateral + THREE.MathUtils.lerp(-9, 9, sectionNoise(310 + palmPatchIndex * 4.43 + side));
        const localZ = z + THREE.MathUtils.lerp(-13, 17, sectionNoise(410 + palmPatchIndex * 5.07 + side));
        const scale = THREE.MathUtils.lerp(0.72, 1.38, sectionNoise(510 + palmPatchIndex * 2.67 + side));
        const lean = THREE.MathUtils.lerp(-0.18, 0.18, sectionNoise(610 + palmPatchIndex * 1.97 + side));
        buildPalm(x, localZ, scale, lean);
        if (sectionNoise(710 + palmPatchIndex * 2.23 + side) > 0.72) {
          buildPalm(
            x + THREE.MathUtils.lerp(-10, 10, sectionNoise(810 + palmPatchIndex * 2.89 + side)),
            localZ + THREE.MathUtils.lerp(7, 18, sectionNoise(910 + palmPatchIndex * 3.19 + side)),
            scale * THREE.MathUtils.lerp(0.58, 0.86, sectionNoise(1010 + palmPatchIndex * 1.41 + side)),
            -lean * 0.7
          );
        }
      }
      z += THREE.MathUtils.lerp(24, 63, n);
      palmPatchIndex += 1;
    }
    palmsRenderedUntil = z;
  }
  renderPalmsUntil(WORLD.length);

  function createSignTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff4d6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff8a65';
    ctx.fillRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function createNameSign(name) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6 * HOUSE_SCALE, 2.6 * HOUSE_SCALE),
      new THREE.MeshBasicMaterial({ map: createSignTexture(name), transparent: true })
    );
    mesh.rotation.y = 0;
    mesh.position.copy(housePoint(-17.2, 4.2, 16));
    scene.add(mesh);
    return {
      mesh,
      update(text) {
        mesh.material.map.dispose();
        mesh.material.map = createSignTexture(text);
        mesh.material.needsUpdate = true;
      }
    };
  }

  function createPetCardTexture(title, rarityLabel, level, income) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ff986b';
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = '#1b5574';
    ctx.font = 'bold 44px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, canvas.width / 2, 18);
    ctx.font = 'bold 28px Trebuchet MS';
    ctx.fillStyle = '#7a58ff';
    ctx.fillText(rarityLabel, canvas.width / 2, 72);
    ctx.font = 'bold 32px Trebuchet MS';
    ctx.fillStyle = '#ff6f51';
    ctx.fillText(`Lv.${level}`, canvas.width / 2, 120);
    ctx.fillStyle = '#2a7c5b';
    ctx.fillText(`${formatPetIncome(income)} gold/s`, canvas.width / 2, 164);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  const houseGroup = new THREE.Group();
  scene.add(houseGroup);
  const HOUSE_SCALE = 3;
  const HOUSE_DESIGN_CENTER = new THREE.Vector3(-24.2, 0, 16);
  const HOUSE_CENTER = new THREE.Vector3(0, 0, WORLD.spawnCenterZ);
  const HOUSE_FACES_RAMP = true;
  const houseMat = new THREE.MeshToonMaterial({ color: '#fff5e3' });
  const roofMat = new THREE.MeshToonMaterial({ color: '#ff8d69' });
  const shelfMat = new THREE.MeshToonMaterial({ color: '#c9853d' });
  const glassMat = new THREE.MeshToonMaterial({ color: '#b8ebff' });

  function housePoint(x, y, z) {
    const localX = x - HOUSE_DESIGN_CENTER.x;
    const localZ = z - HOUSE_DESIGN_CENTER.z;
    if (HOUSE_FACES_RAMP) {
      return new THREE.Vector3(
        HOUSE_CENTER.x - localZ * HOUSE_SCALE,
        y * HOUSE_SCALE,
        HOUSE_CENTER.z + localX * HOUSE_SCALE
      );
    }
    return new THREE.Vector3(
      HOUSE_CENTER.x + localX * HOUSE_SCALE,
      y * HOUSE_SCALE,
      HOUSE_CENTER.z + localZ * HOUSE_SCALE
    );
  }

  function addHouseBlock(x, y, z, w, h, d, material) {
    const position = housePoint(x, y, z);
    const blockW = (HOUSE_FACES_RAMP ? d : w) * HOUSE_SCALE;
    const blockD = (HOUSE_FACES_RAMP ? w : d) * HOUSE_SCALE;
    return addBlock(position.x, position.y, position.z, blockW, h * HOUSE_SCALE, blockD, material, houseGroup);
  }

  addHouseBlock(-24.2, 0.1, 16, 12.8, 0.9, 18, houseMat);
  addHouseBlock(-24.2, 7.4, 16, 12.4, 0.8, 17.4, houseMat);
  addHouseBlock(-24.2, 14.5, 16, 14.4, 1.2, 20.2, roofMat);
  addHouseBlock(-29.7, 7.0, 16, 1.1, 14.4, 18, houseMat);
  addHouseBlock(-24.4, 7.0, 7.2, 11.4, 14.4, 1.1, houseMat);
  addHouseBlock(-24.4, 7.0, 24.8, 11.4, 14.4, 1.1, houseMat);
  addHouseBlock(-18.5, 4.5, 8.0, 1.2, 9, 1.2, houseMat);
  addHouseBlock(-18.5, 4.5, 24.0, 1.2, 9, 1.2, houseMat);
  addHouseBlock(-19.2, 10.8, 16, 1.0, 4.6, 18, glassMat);
  const displaySlots = [];
  const displayItems = [];
  const displaySellButtons = [];
  const slotX = [-27.2, -22.4];
  const slotZ = [9.5, 13.7, 18.1, 22.3];
  const slotY = [1.2, 8.5];

  for (let floor = 0; floor < 2; floor++) {
    for (let row = 0; row < slotZ.length; row++) {
      for (let col = 0; col < slotX.length; col++) {
        const index = floor * 8 + row * 2 + col;
        const position = new THREE.Vector3(slotX[col], slotY[floor], slotZ[row]);
        addHouseBlock(position.x, position.y - 0.4, position.z, 1.8, 0.45, 1.8, new THREE.MeshToonMaterial({ color: '#f6d59e' }));
        displaySlots[index] = housePoint(position.x, position.y, position.z);
        displayItems[index] = null;
      }
    }
  }

  const nameSign = createNameSign(saveState.name);
  const lootItems = [];
  const petPickups = [];
  const waves = [];
  const shops = [];
  const bobbers = [];
  const clickablePetButtons = [];
  const environmentInteractives = [];
  const volcanoes = [];
  const meteorWarnings = [];
  const meteorBlasts = [];
  const delayedHazards = [];
  const temporaryHazardVisuals = [];
  const firePatches = [];
  const landslideBlocks = [];
  const disasterEffects = {
    rainTimer: 0,
    acidRainTimer: 0,
    acidTick: 0,
    windTimer: 0,
    windPulse: 0,
    hailTimer: 0,
    heatTimer: 0,
    fogTimer: 0,
    sandTimer: 0,
    blizzardTimer: 0,
    floodTimer: 0,
    thunderTimer: 0,
    tornadoTimer: 0,
    quakeTimer: 0,
    quakePulse: 0,
    wildfireTimer: 0,
    landslideTimer: 0
  };

  const ecoMaterials = {
    trunk: new THREE.MeshToonMaterial({ color: '#9f6631' }),
    barkDark: new THREE.MeshToonMaterial({ color: '#704018' }),
    leaf: new THREE.MeshToonMaterial({ color: '#40c56a' }),
    leafLight: new THREE.MeshToonMaterial({ color: '#86ef8d' }),
    grass: new THREE.MeshToonMaterial({ color: '#2fbf6b' }),
    grassMint: new THREE.MeshToonMaterial({ color: '#6ee7a4' }),
    grassBlue: new THREE.MeshToonMaterial({ color: '#5bc9a8' }),
    grassGold: new THREE.MeshToonMaterial({ color: '#b7d868' }),
    flowerStem: new THREE.MeshToonMaterial({ color: '#35b86b' }),
    flowerPink: new THREE.MeshToonMaterial({ color: '#ff8fcb', emissive: '#ff8fcb', emissiveIntensity: 0.18 }),
    flowerGold: new THREE.MeshToonMaterial({ color: '#ffd66e', emissive: '#ffd66e', emissiveIntensity: 0.18 }),
    flowerBlue: new THREE.MeshToonMaterial({ color: '#7cc8ff', emissive: '#7cc8ff', emissiveIntensity: 0.18 }),
    flowerRed: new THREE.MeshToonMaterial({ color: '#ff6b5f', emissive: '#ff6b5f', emissiveIntensity: 0.18 }),
    flowerWhite: new THREE.MeshToonMaterial({ color: '#fff7df', emissive: '#fff7df', emissiveIntensity: 0.12 }),
    stone: new THREE.MeshToonMaterial({ color: '#d7ecf0' }),
    glow: new THREE.MeshToonMaterial({ color: '#fff59d', emissive: '#fff59d', emissiveIntensity: 0.65 })
  };
  const treePalettes = [
    { trunk: ecoMaterials.trunk, leaf: ecoMaterials.leaf, leafLight: ecoMaterials.leafLight, fruit: ecoMaterials.flowerGold },
    { trunk: ecoMaterials.barkDark, leaf: new THREE.MeshToonMaterial({ color: '#2f9f5b' }), leafLight: new THREE.MeshToonMaterial({ color: '#5ee084' }), fruit: ecoMaterials.flowerRed },
    { trunk: new THREE.MeshToonMaterial({ color: '#8a5530' }), leaf: new THREE.MeshToonMaterial({ color: '#6bbf59' }), leafLight: new THREE.MeshToonMaterial({ color: '#a4de6a' }), fruit: ecoMaterials.flowerBlue },
    { trunk: new THREE.MeshToonMaterial({ color: '#5f4a2f' }), leaf: new THREE.MeshToonMaterial({ color: '#39b8a0' }), leafLight: new THREE.MeshToonMaterial({ color: '#8ce7d1' }), fruit: ecoMaterials.flowerWhite }
  ];
  const flowerPalette = [ecoMaterials.flowerPink, ecoMaterials.flowerGold, ecoMaterials.flowerBlue, ecoMaterials.flowerRed, ecoMaterials.flowerWhite];
  const grassPalette = [ecoMaterials.grass, ecoMaterials.grassMint, ecoMaterials.grassBlue, ecoMaterials.grassGold];

  function addEcoInteractive(group, target, kind, message, range = 8) {
    environmentInteractives.push({
      group,
      target,
      kind,
      message,
      range,
      pulse: 0,
      cooldown: 0,
      baseY: group.position.y,
      baseScale: group.scale.x,
      offset: Math.random() * Math.PI * 2
    });
  }

  function buildEcoTree(x, z, scale = 1, palette = treePalettes[0]) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 5.6, 6), palette.trunk);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.8, 4.8), palette.leaf);
    const crownTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.0, 3.5), palette.leafLight);
    const fruit = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), palette.fruit);
    trunk.position.y = 2.8;
    crown.position.y = 6.0;
    crown.rotation.y = Math.PI / 4;
    crownTop.position.y = 8.1;
    crownTop.rotation.y = Math.PI / 8;
    fruit.position.set(1.5, 5.0, 1.25);
    for (const part of [trunk, crown, crownTop, fruit]) {
      part.castShadow = true;
      part.receiveShadow = true;
      group.add(part);
    }
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    scene.add(group);
    addEcoInteractive(group, crown, 'tree', 'You shook the tree. Leaves and fruit bounce around you.', 11);
    return group;
  }

  function buildEcoGrassPatch(x, z, scale = 1, material = ecoMaterials.grass) {
    const group = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.4 + (i % 3) * 0.28, 0.18), material);
      blade.position.set((i % 3 - 1) * 0.55, 0.55, (Math.floor(i / 3) - 1) * 0.5);
      blade.rotation.z = (i % 2 ? 0.22 : -0.18);
      blade.rotation.y = i * 0.35;
      group.add(blade);
    }
    const marker = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 2.2), material.clone());
    marker.position.y = 0.15;
    marker.material.transparent = true;
    marker.material.opacity = 0.5;
    group.add(marker);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    scene.add(group);
    addEcoInteractive(group, marker, 'grass', 'The grass ripples like a little green wave.', 7);
    return group;
  }

  function buildEcoFlower(x, z, scale = 1, material = ecoMaterials.flowerPink) {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.8, 0.22), ecoMaterials.flowerStem);
    const bloom = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.34), material);
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.38), ecoMaterials.flowerGold);
    stem.position.y = 0.9;
    bloom.position.y = 1.9;
    bloom.rotation.z = Math.PI / 4;
    center.position.y = 1.9;
    group.add(stem, bloom, center);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    scene.add(group);
    addEcoInteractive(group, bloom, 'flower', 'The flower blooms brighter for a moment.', 6);
    return group;
  }

  function buildEcoGlowPoint(x, z, scale = 1) {
    const group = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 2.4), ecoMaterials.stone);
    const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), ecoMaterials.glow);
    stone.position.y = 0.35;
    glow.position.y = 1.65;
    group.add(stone, glow);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    scene.add(group);
    addEcoInteractive(group, glow, 'glow', 'The little nature point flashes and sends a warm pulse.', 8);
    return group;
  }

  function buildSpawnEcology() {
    const trees = [
      [-103, -128, 1.18, 0], [-76, 18, 0.92, 2], [96, -118, 1.12, 1], [104, 7, 0.86, 3],
      [-112, -48, 1.34, 2], [86, -63, 0.98, 0], [-38, -137, 0.82, 1], [42, 24, 0.78, 3],
      [-14, -122, 0.72, 0], [111, -28, 1.05, 2], [-92, -91, 0.96, 3], [62, -104, 0.88, 1]
    ];
    for (const [x, z, scale, paletteIndex] of trees) buildEcoTree(x, z, scale, treePalettes[paletteIndex % treePalettes.length]);

    const flowers = [
      [-34, 18, 1.0, 0], [19, 26, 0.86, 1], [-58, -21, 0.92, 2], [52, -34, 1.04, 3],
      [-88, -72, 0.82, 4], [77, -83, 0.95, 0], [-17, -108, 1.08, 1], [38, -126, 0.78, 2],
      [-106, -118, 0.9, 3], [109, -101, 0.96, 4], [-74, 5, 0.74, 0], [88, -5, 0.8, 1],
      [-101, -35, 0.86, 2], [29, -82, 0.9, 3], [-47, -133, 0.82, 4], [104, -54, 0.78, 0],
      [-8, 8, 0.72, 1], [62, -139, 0.84, 2], [-112, -5, 0.76, 3], [12, -133, 0.74, 4],
      [-69, -116, 0.8, 0], [74, -121, 0.82, 1], [-92, -141, 0.72, 2], [94, 23, 0.74, 3]
    ];
    for (const [x, z, scale, paletteIndex] of flowers) buildEcoFlower(x, z, scale, flowerPalette[paletteIndex % flowerPalette.length]);

    const grasses = [
      [-42, 25, 1.1, 0], [41, 15, 0.95, 1], [-78, -34, 1.28, 2], [85, -48, 1.18, 3],
      [-108, -93, 1.36, 0], [102, -129, 1.22, 1], [-51, -142, 1.12, 2], [63, -112, 0.92, 3],
      [-13, -17, 0.82, 2], [12, -72, 0.9, 3], [-102, 19, 1.06, 1], [111, -7, 1.0, 0],
      [-67, -105, 0.88, 3], [32, -119, 0.86, 2], [-96, -136, 1.04, 1], [83, 28, 0.82, 0],
      [-25, -137, 0.94, 2], [106, -84, 0.98, 3], [-113, -20, 0.9, 0], [56, -69, 0.84, 1],
      [-6, 24, 0.72, 3], [72, -141, 0.86, 2], [-84, -76, 0.9, 1], [24, -106, 0.76, 0]
    ];
    for (const [x, z, scale, paletteIndex] of grasses) buildEcoGrassPatch(x, z, scale, grassPalette[paletteIndex % grassPalette.length]);

    buildEcoGlowPoint(-58, -96, 0.96);
    buildEcoGlowPoint(67, -44, 0.92);
    buildEcoGlowPoint(21, 18, 0.82);
  }

  buildSpawnEcology();

  const volcanoMaterials = {
    rock: new THREE.MeshToonMaterial({ color: '#4b3a34' }),
    ridge: new THREE.MeshToonMaterial({ color: '#2f2826' }),
    ash: new THREE.MeshToonMaterial({ color: '#8a7b73' }),
    lava: new THREE.MeshToonMaterial({ color: '#ff5a27', emissive: '#ff2f12', emissiveIntensity: 0.75 }),
    smoke: new THREE.MeshToonMaterial({ color: '#6f7375', transparent: true, opacity: 0.72 }),
    meteor: new THREE.MeshToonMaterial({ color: '#34231f', emissive: '#ff4b1f', emissiveIntensity: 0.65 }),
    warning: new THREE.MeshBasicMaterial({ color: '#36110c', transparent: true, opacity: 0.44, depthWrite: false }),
    warningRing: new THREE.MeshBasicMaterial({ color: '#ff4427', transparent: true, opacity: 0.78, depthWrite: false })
  };
  const rainGroup = new THREE.Group();
  const windGroup = new THREE.Group();
  const hailGroup = new THREE.Group();
  const sandGroup = new THREE.Group();
  const snowGroup = new THREE.Group();
  const fogGroup = new THREE.Group();
  const floodGroup = new THREE.Group();
  const tornadoGroup = new THREE.Group();
  const rainMaterial = new THREE.MeshBasicMaterial({ color: '#aee8ff', transparent: true, opacity: 0.62 });
  const windMaterial = new THREE.MeshBasicMaterial({ color: '#f4ffff', transparent: true, opacity: 0.44 });
  const hailMaterial = new THREE.MeshBasicMaterial({ color: '#f6ffff', transparent: true, opacity: 0.86 });
  const sandMaterial = new THREE.MeshBasicMaterial({ color: '#f0c16f', transparent: true, opacity: 0.32, depthWrite: false });
  const snowMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.74 });
  const fogMaterial = new THREE.MeshBasicMaterial({ color: '#e7fbff', transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
  const floodMaterial = new THREE.MeshBasicMaterial({ color: '#4bd8ff', transparent: true, opacity: 0.32, depthWrite: false });
  const tornadoMaterial = new THREE.MeshBasicMaterial({ color: '#d7e3df', transparent: true, opacity: 0.48, depthWrite: false });
  for (let i = 0; i < 90; i++) {
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.8, 0.08), rainMaterial);
    drop.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth), 8 + Math.random() * 16, THREE.MathUtils.randFloatSpread(150));
    drop.rotation.z = 0.25;
    rainGroup.add(drop);
  }
  for (let i = 0; i < 26; i++) {
    const gust = new THREE.Mesh(new THREE.BoxGeometry(11 + Math.random() * 16, 0.22, 0.22), windMaterial);
    gust.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth), 3 + Math.random() * 8, THREE.MathUtils.randFloatSpread(130));
    gust.rotation.y = 0.08;
    windGroup.add(gust);
  }
  for (let i = 0; i < 64; i++) {
    const hail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), hailMaterial);
    hail.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth), 8 + Math.random() * 18, THREE.MathUtils.randFloatSpread(145));
    hailGroup.add(hail);
  }
  for (let i = 0; i < 18; i++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(30 + Math.random() * 36, 11 + Math.random() * 8), sandMaterial);
    sheet.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth), 6 + Math.random() * 7, THREE.MathUtils.randFloatSpread(140));
    sheet.rotation.set(-0.12, Math.PI / 2 + 0.2, 0);
    sandGroup.add(sheet);
  }
  for (let i = 0; i < 90; i++) {
    const flake = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), snowMaterial);
    flake.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth), 6 + Math.random() * 16, THREE.MathUtils.randFloatSpread(145));
    snowGroup.add(flake);
  }
  for (let i = 0; i < 8; i++) {
    const cloudSheet = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.laneWidth * 0.72, 22), fogMaterial);
    cloudSheet.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth * 0.3), 9, -65 + i * 18);
    cloudSheet.rotation.y = Math.PI / 2;
    fogGroup.add(cloudSheet);
  }
  const floodSheet = new THREE.Mesh(new THREE.BoxGeometry(WORLD.laneWidth + 14, 0.22, 172), floodMaterial);
  floodSheet.position.y = 0.32;
  floodGroup.add(floodSheet);
  for (let i = 0; i < 7; i++) {
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.2 + i * 0.62, 2.7 + i * 0.78, 2.8, 7, 1, true), tornadoMaterial);
    funnel.position.y = 1.5 + i * 2.25;
    funnel.rotation.z = (i % 2 ? -0.12 : 0.12);
    tornadoGroup.add(funnel);
  }
  rainGroup.visible = false;
  windGroup.visible = false;
  hailGroup.visible = false;
  sandGroup.visible = false;
  snowGroup.visible = false;
  fogGroup.visible = false;
  floodGroup.visible = false;
  tornadoGroup.visible = false;
  scene.add(rainGroup, windGroup, hailGroup, sandGroup, snowGroup, fogGroup, floodGroup, tornadoGroup);
  let volcanoesRenderedUntil = WORLD.homeDepth + 80;
  let volcanoPatchIndex = 0;

  function buildVolcano(x, z, scale = 1) {
    const group = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 17, 26, 9), volcanoMaterials.rock);
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 4.0, 2.2, 9), volcanoMaterials.lava);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.3, 1.3, 9), volcanoMaterials.ridge);
    const smokeBase = new THREE.Group();
    cone.position.y = 13;
    crater.position.y = 26.2;
    inner.position.y = 27.0;
    for (let i = 0; i < 7; i++) {
      const flow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.34, 13 + (i % 3) * 3), volcanoMaterials.lava);
      flow.position.y = 15 - (i % 3) * 2.1;
      flow.position.z = 4.2 + i * 0.2;
      flow.rotation.y = (i / 7) * Math.PI * 2;
      flow.rotation.x = 0.54;
      group.add(flow);
    }
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.BoxGeometry(4 + i * 0.9, 3.0, 4 + i * 0.9), volcanoMaterials.smoke);
      puff.position.set((i - 2) * 1.3, 30 + i * 2.2, (i % 2 ? 1 : -1) * 1.4);
      puff.rotation.y = i * 0.55;
      smokeBase.add(puff);
    }
    group.add(cone, crater, inner, smokeBase);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    scene.add(group);
    volcanoes.push({ group, crater, smokeBase, offset: Math.random() * Math.PI * 2 });
    return group;
  }

  function renderVolcanoesUntil(limitZ) {
    while (volcanoesRenderedUntil < limitZ + 260) {
      const leftChance = sectionNoise(2000 + volcanoPatchIndex * 2.17);
      const rightChance = sectionNoise(2100 + volcanoPatchIndex * 2.71);
      const sides = [];
      if (leftChance > 0.22) sides.push(-1);
      if (rightChance > 0.38) sides.push(1);
      if (!sides.length) sides.push(sectionNoise(2200 + volcanoPatchIndex) > 0.5 ? 1 : -1);
      for (const side of sides) {
        const x = side * THREE.MathUtils.lerp(WORLD.laneWidth / 2 + 46, WORLD.laneWidth / 2 + 112, sectionNoise(2300 + volcanoPatchIndex * 3.13 + side));
        const z = volcanoesRenderedUntil + THREE.MathUtils.lerp(-34, 38, sectionNoise(2400 + volcanoPatchIndex * 4.01 + side));
        const scale = THREE.MathUtils.lerp(0.92, 1.72, sectionNoise(2500 + volcanoPatchIndex * 1.83 + side));
        buildVolcano(x, z, scale);
      }
      volcanoesRenderedUntil += THREE.MathUtils.lerp(72, 168, sectionNoise(2600 + volcanoPatchIndex * 2.49));
      volcanoPatchIndex += 1;
    }
  }
  renderVolcanoesUntil(WORLD.length);

  const rivalColors = [
    { name: 'Mint Kid', skin: '#fff1d9', shirt: '#30cba5', shorts: '#1e7f69' },
    { name: 'Sunset Kid', skin: '#ffe7d1', shirt: '#ff8f6b', shorts: '#b44d45' },
    { name: 'Berry Kid', skin: '#f9e0d2', shirt: '#b583ff', shorts: '#6d46bf' },
    { name: 'Sky Kid', skin: '#f8e2cc', shirt: '#50baf2', shorts: '#1e6e9b' }
  ];

  function makeCarryVisual(color) {
    const group = new THREE.Group();
    const gemMaterial = new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 0.45 });
    const gem = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), gemMaterial);
    gem.rotation.y = Math.PI / 4;
    gem.position.y = 3.95;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.5), new THREE.MeshToonMaterial({ color: '#ffffff' }));
    plate.position.y = 3.15;
    group.add(plate, gem);
    group.visible = false;
    return group;
  }

  function createCharacter({ palette, scale = 1 }) {
    const group = new THREE.Group();
    const skin = new THREE.MeshToonMaterial({ color: palette.skin });
    const shirt = new THREE.MeshToonMaterial({ color: palette.shirt });
    const shorts = new THREE.MeshToonMaterial({ color: palette.shorts });
    const shoe = new THREE.MeshToonMaterial({ color: '#ffffff' });
    const hair = new THREE.MeshToonMaterial({ color: '#5b4230' });
    const face = new THREE.MeshToonMaterial({ color: '#fff7ea' });
    const accent = new THREE.MeshToonMaterial({ color: '#ffd989' });
    const dark = new THREE.MeshToonMaterial({ color: '#21415f' });
    const outline = new THREE.MeshToonMaterial({ color: '#2d2a2a' });
    const eyeWhite = new THREE.MeshToonMaterial({ color: '#fffaf0' });
    const pupil = new THREE.MeshToonMaterial({ color: '#17202a' });
    const blush = new THREE.MeshToonMaterial({ color: '#ff9f91' });
    const skinShade = new THREE.MeshToonMaterial({ color: '#e9b98f' });
    const shirtTrim = new THREE.MeshToonMaterial({ color: '#fff0a8' });

    const torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.08, 0.88), shirt);
    const waist = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.58, 0.74), shirt);
    const shoulderBar = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.34, 0.82), accent);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.16, 0.8), dark);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.95), face);
    const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.06), shirtTrim);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.07), dark);
    const shirtHem = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.08), outline);
    const leftShirtSeam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.07), outline);
    const rightShirtSeam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.07), outline);
    chest.position.y = 0.18;
    waist.position.y = -0.7;
    shoulderBar.position.y = 0.72;
    belt.position.y = -0.44;
    collar.position.set(0, 0.83, 0.5);
    shirtPanel.position.set(0, 0.12, 0.49);
    badge.position.set(0.38, 0.42, 0.53);
    shirtHem.position.set(0, -0.97, 0.43);
    leftShirtSeam.position.set(-0.67, 0.08, 0.46);
    rightShirtSeam.position.set(0.67, 0.08, 0.46);
    torso.add(chest, waist, shoulderBar, belt, collar, shirtPanel, badge, shirtHem, leftShirtSeam, rightShirtSeam);
    torso.position.y = 1.62;

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.18, 1.08), skin);
    const hairCap = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.5, 1.2), hair);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.92, 0.28), hair);
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.34, 0.2), hair);
    const leftBang = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), hair);
    const rightBang = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.22), hair);
    const leftSideHair = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.82, 0.42), hair);
    const rightSideHair = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.82, 0.42), hair);
    const crownBlock = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.82), hair);
    const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.05), face);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.05), dark);
    const leftEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.055), eyeWhite);
    const rightEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.055), eyeWhite);
    const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.065), pupil);
    const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.065), pupil);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.075), skinShade);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.075), dark);
    const leftCheek = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), blush);
    const rightCheek = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), blush);
    const leftEar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.22), skin);
    const rightEar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.22), skin);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.32), skin);
    head.position.y = 3.0;
    hairCap.position.set(0, 3.42, 0);
    hairBack.position.set(0, 3.02, -0.62);
    fringe.position.set(0, 3.16, 0.64);
    leftBang.position.set(-0.36, 2.98, 0.67);
    rightBang.position.set(0.36, 3.0, 0.67);
    leftSideHair.position.set(-0.71, 3.02, 0.05);
    rightSideHair.position.set(0.71, 3.02, 0.05);
    crownBlock.position.set(0, 3.62, -0.08);
    facePlate.position.set(0, 2.96, 0.57);
    brow.position.set(0, 3.14, 0.58);
    leftEyeWhite.position.set(-0.25, 3.03, 0.62);
    rightEyeWhite.position.set(0.25, 3.03, 0.62);
    leftPupil.position.set(-0.25, 3.02, 0.66);
    rightPupil.position.set(0.25, 3.02, 0.66);
    nose.position.set(0, 2.9, 0.65);
    mouth.position.set(0, 2.75, 0.65);
    leftCheek.position.set(-0.42, 2.82, 0.63);
    rightCheek.position.set(0.42, 2.82, 0.63);
    leftEar.position.set(-0.68, 3.02, 0);
    rightEar.position.set(0.68, 3.02, 0);
    neck.position.set(0, 2.28, 0);

    const createArm = (side) => {
      const arm = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.92, 0.46), shirt);
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.62, 0.38), skin);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.34), skin);
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), shirtTrim);
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.18), skinShade);
      const fingerA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.18), skinShade);
      const fingerB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.18), skinShade);
      sleeve.position.y = -0.42;
      forearm.position.y = -1.12;
      hand.position.y = -1.54;
      cuff.position.y = -0.88;
      thumb.position.set(side * 0.22, -1.48, 0.16);
      fingerA.position.set(side * -0.07, -1.66, 0.14);
      fingerB.position.set(side * 0.08, -1.66, 0.14);
      arm.add(sleeve, forearm, hand, cuff, thumb, fingerA, fingerB);
      arm.position.set(side * 0.98, 2.2, 0);
      return arm;
    };

    const createLeg = (side) => {
      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.78, 0.52), shorts);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.46), skin);
      const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.46), dark);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.82), shoe);
      const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.9), dark);
      const laceA = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.045, 0.045), dark);
      const laceB = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.045, 0.045), dark);
      thigh.position.y = -0.38;
      shin.position.y = -1.12;
      ankle.position.y = -1.54;
      foot.position.set(0, -1.76, 0.14);
      shoeSole.position.set(0, -1.93, 0.16);
      laceA.position.set(0, -1.63, 0.55);
      laceA.rotation.z = 0.28;
      laceB.position.set(0, -1.63, 0.55);
      laceB.rotation.z = -0.28;
      leg.add(thigh, shin, ankle, foot, shoeSole, laceA, laceB);
      leg.position.set(side * 0.36, 0.84, 0);
      return leg;
    };

    const leftArm = createArm(-1);
    const rightArm = createArm(1);
    const leftLeg = createLeg(-1);
    const rightLeg = createLeg(1);

    for (const part of [
      torso, head, hairCap, hairBack, fringe, leftBang, rightBang, leftSideHair, rightSideHair, crownBlock, facePlate, brow,
      leftEyeWhite, rightEyeWhite, leftPupil, rightPupil, nose, mouth, leftCheek, rightCheek, leftEar, rightEar,
      neck, leftArm, rightArm, leftLeg, rightLeg
    ]) {
      part.traverse?.((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      if (!part.isGroup) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
      group.add(part);
    }

    const carryVisual = makeCarryVisual('#ffffff');
    group.add(carryVisual);
    group.scale.setScalar(scale);

    return {
      group,
      bones: {
        head,
        body: torso,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        carryVisual,
        materials: {
          skin,
          shirt,
          shorts,
          shoe,
          hair,
          face,
          accent,
          dark,
          blush,
          skinShade,
          shirtTrim
        },
        base: {
          headY: 3.0,
          bodyY: 1.62,
          armY: 2.2,
          legY: 0.84
        }
      }
    };
  }

  function makeActor(name, palette, isPlayer = false) {
    const character = createCharacter({ palette, scale: isPlayer ? 1.1 : 1 });
    const baseY = isPlayer ? 1.15 : 1.05;
    const actor = {
      name,
      isPlayer,
      group: character.group,
      bones: character.bones,
      velocity: new THREE.Vector3(),
      baseY,
      verticalVelocity: 0,
      grounded: true,
      carrying: null,
      carryingPet: null,
      petCarryMesh: null,
      stun: 0,
      stealCooldown: 0,
      weaponCooldown: 0,
      attackTimer: 0,
      targetLoot: null,
      respawnX: isPlayer ? 0 : (Math.random() * 12 - 6),
      runCycle: Math.random() * Math.PI * 2
    };
    actor.group.position.set(actor.respawnX, baseY, 12 + Math.random() * 3);
    scene.add(actor.group);
    return actor;
  }

  const player = makeActor(saveState.name, { skin: '#ffe2c3', shirt: '#ff7b66', shorts: '#3756c4' }, true);
  const bots = rivalColors.map((palette, index) => {
    const bot = makeActor(palette.name, palette, false);
    bot.group.position.set((index - 1.5) * 4.4, bot.baseY, 12 + index);
    return bot;
  });
  const actors = [player, ...bots];

  function colorOffset(hex, lightness = 0) {
    return new THREE.Color(hex).offsetHSL(0, -0.04, lightness).getStyle();
  }

  function applyCharacterCostume(actor, costumeKey) {
    const costume = costumeByKey.get(costumeKey) || costumeByKey.get('beach');
    const palette = costume.palette;
    const materials = actor.bones.materials;
    materials.skin.color.set(palette.skin);
    materials.shirt.color.set(palette.shirt);
    materials.shorts.color.set(palette.shorts);
    materials.shoe.color.set(palette.shoe);
    materials.hair.color.set(palette.hair);
    materials.face.color.set(palette.face);
    materials.accent.color.set(palette.accent);
    materials.dark.color.set(palette.dark);
    materials.shirtTrim.color.set(palette.trim);
    materials.skinShade.color.set(colorOffset(palette.skin, -0.13));
    materials.blush.color.set(colorOffset(palette.skin, 0.08));
    Object.values(materials).forEach((material) => {
      if (!material.emissive) return;
      material.emissive.set('#000000');
      material.emissiveIntensity = 0;
    });
    if (costume.key === 'galaxy') {
      materials.shirt.emissive.set('#3a1b91');
      materials.shirt.emissiveIntensity = 0.22;
      materials.accent.emissive.set('#ff5de8');
      materials.accent.emissiveIntensity = 0.42;
      materials.shirtTrim.emissive.set('#7bf7ff');
      materials.shirtTrim.emissiveIntensity = 0.5;
      materials.shoe.emissive.set('#7bf7ff');
      materials.shoe.emissiveIntensity = 0.3;
    }
    refreshCostumeAccessories(actor, costume);
  }

  function addAccessoryBlock(group, w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({ color }));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addAccessoryPair(group, w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    addAccessoryBlock(group, w, h, d, color, -x, y, z, rx, -ry, -rz);
    addAccessoryBlock(group, w, h, d, color, x, y, z, rx, ry, rz);
  }

  function addGlowAccessoryBlock(group, w, h, d, color, x, y, z, intensity = 0.45, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity
    }));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addGlowAccessoryPair(group, w, h, d, color, x, y, z, intensity = 0.45, rx = 0, ry = 0, rz = 0) {
    addGlowAccessoryBlock(group, w, h, d, color, -x, y, z, intensity, rx, -ry, -rz);
    addGlowAccessoryBlock(group, w, h, d, color, x, y, z, intensity, rx, ry, rz);
  }

  function buildCostumeAccessory(costume) {
    const group = new THREE.Group();
    const p = costume.palette;

    if (costume.key === 'beach') {
      addAccessoryBlock(group, 1.5, 0.12, 1.34, '#ffe47a', 0, 3.72, 0.03);
      addAccessoryBlock(group, 1.12, 0.28, 0.9, '#fff3a8', 0, 3.86, 0.0);
      addAccessoryBlock(group, 0.92, 0.08, 0.36, '#ff8f6b', 0, 3.99, 0.0);
      addAccessoryPair(group, 0.74, 0.1, 0.98, '#7fdcff', 0.32, -1.08, 0.18);
      addAccessoryPair(group, 0.42, 0.08, 0.62, '#ffffff', 0.32, -0.98, 0.38);
    } else if (costume.key === 'ninja') {
      addAccessoryBlock(group, 1.38, 0.96, 1.18, '#111722', 0, 3.08, 0.02);
      addAccessoryBlock(group, 1.08, 0.26, 0.08, '#74d7ff', 0, 3.08, 0.65);
      addAccessoryBlock(group, 0.72, 0.1, 0.08, '#0c121c', 0, 2.74, 0.67);
      addAccessoryPair(group, 0.12, 0.64, 0.12, '#74d7ff', 0.68, 3.2, -0.12, 0, 0, 0.25);
      addAccessoryPair(group, 0.7, 0.22, 1.0, '#10131a', 0.32, -1.1, 0.18);
      addAccessoryPair(group, 0.46, 0.12, 0.82, '#74d7ff', 0.32, -0.95, 0.2);
    } else if (costume.key === 'dragon') {
      addAccessoryBlock(group, 1.48, 0.5, 1.22, '#6f6cff', 0, 3.58, 0.0);
      addAccessoryPair(group, 0.22, 0.62, 0.18, '#ffe67b', 0.34, 3.92, 0.18, -0.35, 0, 0.2);
      addAccessoryBlock(group, 0.2, 0.34, 0.2, '#ffe67b', 0, 3.92, -0.36, 0, 0, Math.PI / 4);
      addAccessoryBlock(group, 0.2, 0.3, 0.2, '#ffe67b', 0, 3.62, -0.64, 0, 0, Math.PI / 4);
      addAccessoryPair(group, 0.34, 0.12, 0.96, '#89dfff', 0.92, 2.12, -0.16, 0.2, 0.15, 0.45);
      addAccessoryPair(group, 0.72, 0.18, 1.06, '#c7f4ff', 0.32, -1.08, 0.18);
      addAccessoryPair(group, 0.12, 0.18, 0.16, '#ffe67b', 0.52, -0.86, 0.52);
    } else if (costume.key === 'galaxy') {
      addAccessoryBlock(group, 1.5, 0.34, 1.22, '#080414', 0, 3.7, 0);
      addAccessoryBlock(group, 1.24, 0.34, 0.16, '#101846', 0, 3.18, 0.65);
      addGlowAccessoryBlock(group, 1.08, 0.12, 0.1, '#7bf7ff', 0, 3.2, 0.76, 0.78);
      addGlowAccessoryBlock(group, 0.72, 0.08, 0.11, '#ff5de8', 0, 3.08, 0.79, 0.7);
      addGlowAccessoryBlock(group, 0.3, 0.3, 0.08, '#fff36d', 0, 2.22, 0.56, 0.82, 0, 0, Math.PI / 4);
      addGlowAccessoryBlock(group, 0.18, 0.9, 0.08, '#7bf7ff', -0.56, 2.0, 0.54, 0.45);
      addGlowAccessoryBlock(group, 0.18, 0.9, 0.08, '#ff5de8', 0.56, 2.0, 0.54, 0.45);
      addGlowAccessoryPair(group, 0.18, 1.1, 0.12, '#7bf7ff', 0.88, 2.24, -0.28, 0.55, 0.12, 0.2, 0.55);
      addGlowAccessoryPair(group, 0.18, 1.18, 0.12, '#ff5de8', 1.12, 2.08, -0.38, 0.48, -0.08, -0.24, 0.78);
      addGlowAccessoryPair(group, 0.1, 0.84, 0.1, '#fff36d', 1.34, 1.88, -0.46, 0.42, -0.12, -0.18, 0.92);
      const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.045, 6, 40), new THREE.MeshToonMaterial({
        color: '#7bf7ff',
        emissive: '#7bf7ff',
        emissiveIntensity: 0.65
      }));
      orbitRing.position.set(0, 3.62, 0);
      orbitRing.rotation.set(Math.PI / 2, 0.35, 0.18);
      orbitRing.userData.galaxySpin = 0.65;
      group.add(orbitRing);
      const starColors = ['#7bf7ff', '#ff5de8', '#fff36d', '#ffffff', '#9b7bff'];
      for (let i = 0; i < 18; i++) {
        const angle = i * 1.87;
        const radius = 0.38 + (i % 4) * 0.18;
        const star = addGlowAccessoryBlock(
          group,
          i % 5 === 0 ? 0.16 : 0.09,
          i % 5 === 0 ? 0.16 : 0.09,
          0.08,
          starColors[i % starColors.length],
          Math.cos(angle) * radius,
          3.48 + (i % 3) * 0.22,
          Math.sin(angle) * 0.46,
          0.75
        );
        star.userData.galaxyStar = { angle, radius, baseY: star.position.y, speed: 0.75 + (i % 4) * 0.22 };
      }
      addAccessoryPair(group, 0.84, 0.22, 1.04, '#dff8ff', 0.32, -1.1, 0.18);
      addGlowAccessoryPair(group, 0.56, 0.1, 0.86, '#7bf7ff', 0.32, -0.9, 0.2, 0.72);
      addGlowAccessoryPair(group, 0.18, 0.12, 0.28, '#ff5de8', 0.52, -0.78, 0.48, 0.7);
    } else if (costume.key === 'forest') {
      addAccessoryBlock(group, 1.24, 0.28, 1.02, '#245b42', 0, 3.62, 0);
      addAccessoryBlock(group, 0.92, 0.12, 0.5, '#b7d868', 0, 3.48, 0.54);
      addAccessoryBlock(group, 0.22, 0.16, 0.16, '#ff6b5f', 0.34, 3.68, 0.4);
      addAccessoryBlock(group, 1.0, 1.18, 0.28, '#6a4528', 0, 1.56, -0.72);
      addAccessoryBlock(group, 0.82, 0.88, 0.18, '#b7d868', 0, 1.56, -0.9);
      addAccessoryPair(group, 0.74, 0.2, 1.0, '#f0e1b0', 0.32, -1.08, 0.18);
      addAccessoryPair(group, 0.42, 0.14, 0.88, '#245b42', 0.32, -0.9, 0.16);
    } else if (costume.key === 'volcano') {
      addAccessoryBlock(group, 1.42, 0.36, 1.14, '#231715', 0, 3.66, 0);
      addAccessoryBlock(group, 1.2, 0.12, 0.98, '#ff6337', 0, 3.84, 0);
      addAccessoryBlock(group, 0.28, 0.46, 0.28, '#ffcf69', -0.28, 4.08, 0.12, 0, 0, Math.PI / 4);
      addAccessoryBlock(group, 0.24, 0.58, 0.24, '#ff6337', 0.12, 4.16, -0.16, 0, 0, Math.PI / 4);
      addAccessoryBlock(group, 0.2, 0.36, 0.2, '#ffcf69', 0.42, 3.98, 0.02, 0, 0, Math.PI / 4);
      addAccessoryPair(group, 0.78, 0.22, 1.04, '#ffb36b', 0.32, -1.08, 0.18);
      addAccessoryPair(group, 0.5, 0.1, 0.86, '#ff6337', 0.32, -0.9, 0.2);
    }

    return group;
  }

  function refreshCostumeAccessories(actor, costume) {
    if (actor.bones.costumeAccessory) {
      actor.group.remove(actor.bones.costumeAccessory);
      actor.bones.costumeAccessory = null;
    }
    const accessory = buildCostumeAccessory(costume);
    actor.group.add(accessory);
    actor.bones.costumeAccessory = accessory;
  }

  function animateCostumeAccessory(accessory, elapsed, delta) {
    if (!accessory) return;
    accessory.traverse((child) => {
      if (child.userData.galaxySpin) {
        child.rotation.z += delta * child.userData.galaxySpin;
      }
      if (child.userData.galaxyStar) {
        const star = child.userData.galaxyStar;
        const phase = elapsed * star.speed + star.angle;
        child.position.x = Math.cos(phase) * star.radius;
        child.position.z = Math.sin(phase) * 0.46;
        child.position.y = star.baseY + Math.sin(phase * 1.6) * 0.05;
      }
    });
  }

  function buildCostumePreview(costume) {
    const previewCharacter = createCharacter({ palette: costume.palette, scale: 0.42 });
    refreshCostumeAccessories({ group: previewCharacter.group, bones: previewCharacter.bones }, costume);
    const preview = previewCharacter.group;
    preview.rotation.y = Math.PI;
    return preview;
  }

  applyCharacterCostume(player, saveState.costumeKey);

  let activeWeaponMesh = null;
  let firstPersonWeaponMesh = null;

  function buildWeaponModel(weapon, preview = false) {
    const group = new THREE.Group();
    if (!weapon || weapon.key === 'none') return group;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), new THREE.MeshToonMaterial({ color: weapon.color }));
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.16), new THREE.MeshToonMaterial({ color: '#fff0a8' }));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, preview ? 1.9 : 1.55, 0.16), new THREE.MeshToonMaterial({ color: weapon.blade, emissive: weapon.blade, emissiveIntensity: weapon.key.includes('storm') || weapon.key.includes('boss') ? 0.35 : 0.08 }));
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.18), new THREE.MeshToonMaterial({ color: weapon.blade, emissive: weapon.blade, emissiveIntensity: 0.22 }));
    grip.position.y = -0.55;
    guard.position.y = -0.23;
    blade.position.y = preview ? 0.72 : 0.52;
    tip.position.y = preview ? 1.74 : 1.34;
    tip.rotation.z = Math.PI / 4;
    group.add(grip, guard, blade, tip);
    if (weapon.key === 'storm_sword') {
      addAccessoryBlock(group, 0.08, 1.4, 0.08, '#ffffff', -0.22, 0.62, 0, 0, 0, 0.38);
      addAccessoryBlock(group, 0.08, 1.1, 0.08, '#7fdcff', 0.24, 0.48, 0, 0, 0, -0.38);
    }
    if (weapon.key === 'boss_sword') {
      addAccessoryBlock(group, 0.34, 0.34, 0.22, '#ffcf69', 0, 0.06, 0, 0, 0, Math.PI / 4);
      addAccessoryBlock(group, 0.1, 1.5, 0.1, '#ffcf69', 0.2, 0.58, 0, 0, 0, -0.2);
      addAccessoryBlock(group, 0.1, 1.5, 0.1, '#ff8f6b', -0.2, 0.58, 0, 0, 0, 0.2);
    }
    if (weapon.key === 'god_deck_sword') {
      group.userData.isGodDeckSword = true;
      addAccessoryBlock(group, 0.42, 0.42, 0.28, '#fff36d', 0, -0.05, 0, 0, 0, Math.PI / 4);
      addAccessoryBlock(group, 1.28, 0.2, 0.34, '#150b2b', 0, -0.38, 0);
      addAccessoryBlock(group, 0.92, 0.14, 0.2, '#7fdcff', 0, -0.22, 0);
      addAccessoryBlock(group, 0.72, 0.1, 0.28, '#ff9ee8', 0, -0.5, 0.02);
      addAccessoryBlock(group, 0.14, 2.25, 0.12, '#ffffff', 0, 0.9, 0.02);
      addAccessoryBlock(group, 0.42, 1.85, 0.1, '#fff36d', -0.18, 0.84, 0.04, 0, 0, 0.08);
      addAccessoryBlock(group, 0.42, 1.85, 0.1, '#7fdcff', 0.18, 0.84, 0.04, 0, 0, -0.08);
      addAccessoryBlock(group, 0.1, 2.45, 0.08, '#ff9ee8', -0.36, 0.88, 0.08, 0, 0, 0.18);
      addAccessoryBlock(group, 0.1, 2.45, 0.08, '#8fb3ff', 0.36, 0.88, 0.08, 0, 0, -0.18);
      addAccessoryBlock(group, 0.06, 2.65, 0.06, '#ffffff', 0, 0.96, 0.18, 0, 0, 0.04);
      addAccessoryBlock(group, 0.08, 2.35, 0.08, '#fff36d', -0.52, 0.76, 0.12, 0, 0, 0.26);
      addAccessoryBlock(group, 0.08, 2.35, 0.08, '#7fdcff', 0.52, 0.76, 0.12, 0, 0, -0.26);
      addAccessoryBlock(group, 0.18, 0.18, 0.18, '#ff9ee8', 0, 2.1, 0.08, 0, 0, Math.PI / 4);
      addAccessoryBlock(group, 0.36, 0.36, 0.2, '#ffffff', 0, 2.35, 0.1, 0, 0, Math.PI / 4);
      addAccessoryBlock(group, 0.22, 0.22, 0.16, '#fff36d', 0, 2.6, 0.08, 0, 0, Math.PI / 4);
      addAccessoryPair(group, 0.1, 1.35, 0.1, '#ff9ee8', 0.34, 0.74, 0.08, 0, 0, 0.32);
      addAccessoryPair(group, 0.12, 1.05, 0.1, '#8fb3ff', 0.5, 0.42, 0.06, 0, 0, 0.58);
      addAccessoryPair(group, 0.28, 0.28, 0.16, '#fff36d', 0.58, -0.24, 0.08, 0, 0, Math.PI / 4);
      addAccessoryPair(group, 0.22, 0.22, 0.14, '#7fdcff', 0.78, -0.04, 0.08, 0, 0, Math.PI / 4);
      addAccessoryPair(group, 0.14, 0.14, 0.12, '#ffffff', 0.92, 0.18, 0.08, 0, 0, Math.PI / 4);
      addAccessoryPair(group, 0.16, 0.9, 0.08, '#fff36d', 0.7, 0.82, 0.18, 0, 0, 0.72);
      addAccessoryPair(group, 0.16, 0.9, 0.08, '#7fdcff', 0.7, 1.34, 0.18, 0, 0, -0.72);
      for (let i = 0; i < 7; i++) {
        addAccessoryBlock(group, 0.08, 0.08, 0.08, i % 2 ? '#fff36d' : '#ff9ee8', -0.36 + i * 0.12, 1.95 + (i % 3) * 0.08, 0.16);
      }
      for (let i = 0; i < 5; i++) {
        const orb = addAccessoryBlock(group, 0.12, 0.12, 0.12, i % 2 ? '#7fdcff' : '#fff36d', Math.cos(i * 1.26) * 0.72, 1.05 + i * 0.18, Math.sin(i * 1.26) * 0.18);
        orb.userData.orbit = i * 1.26;
      }
      const aura = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.045, 8, 32),
        new THREE.MeshBasicMaterial({ color: '#fff36d', transparent: true, opacity: 0.72 })
      );
      aura.position.y = 1.2;
      aura.rotation.x = Math.PI / 2;
      group.add(aura);
      const auraTwo = aura.clone();
      auraTwo.material = new THREE.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.56 });
      auraTwo.position.y = 1.55;
      auraTwo.scale.setScalar(0.78);
      group.add(auraTwo);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.035, 8, 32),
        new THREE.MeshBasicMaterial({ color: '#ff9ee8', transparent: true, opacity: 0.62 })
      );
      halo.position.y = 2.24;
      halo.rotation.x = Math.PI / 2;
      halo.userData.spin = -1;
      group.add(halo);
    }
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return group;
  }

  function equipWeapon(weaponKey, persist = true) {
    const weapon = weaponByKey.get(weaponKey) || weaponByKey.get('none');
    if (activeWeaponMesh) {
      player.bones.rightArm.remove(activeWeaponMesh);
      player.bones.leftArm.remove(activeWeaponMesh);
      activeWeaponMesh = null;
    }
    if (firstPersonWeaponMesh) {
      scene.remove(firstPersonWeaponMesh);
      firstPersonWeaponMesh = null;
    }
    saveState.weaponKey = weapon.key;
    if (weapon.key !== 'none') {
      activeWeaponMesh = buildWeaponModel(weapon, false);
      activeWeaponMesh.position.set(0.36, -1.48, 0.85);
      activeWeaponMesh.rotation.set(Math.PI / 2, 0, 0);
      player.bones.rightArm.add(activeWeaponMesh);

      firstPersonWeaponMesh = buildWeaponModel(weapon, false);
      firstPersonWeaponMesh.scale.setScalar(0.16);
      firstPersonWeaponMesh.visible = false;
      scene.add(firstPersonWeaponMesh);
    }
    if (persist) {
      queueSave(`${weapon.label} equipped.`);
      showToast(`Equipped ${weapon.label}. Left click with mouse locked to slash rivals.`);
    }
  }

  function buildPetModel(petKey, preview = false) {
    const pet = petByKey.get(petKey) || petByKey.get('none');
    const group = new THREE.Group();
    if (pet.key === 'none') return group;

    const addPart = (w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({ color }));
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      group.add(mesh);
      return mesh;
    };
    const addPair = (w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
      addPart(w, h, d, color, -x, y, z, rx, -ry, -rz);
      addPart(w, h, d, color, x, y, z, rx, ry, rz);
    };
    const addEyePair = (x, y, z, size = 0.18, pupilColor = '#101820') => {
      addPair(size, size, 0.08, '#fffaf0', x, y, z);
      addPair(size * 0.44, size * 0.52, 0.09, pupilColor, x, y - size * 0.03, z + 0.055);
    };
    const addBodySpots = (spots, color) => {
      for (const spot of spots) addPart(spot[3], spot[4], 0.07, color, spot[0], spot[1], spot[2]);
    };
    const addBackSpikes = (count, startZ, stepZ, y, color, size = 0.22) => {
      for (let i = 0; i < count; i++) {
        addPart(size, size * 1.35, size, color, 0, y, startZ + i * stepZ, 0, 0, Math.PI / 4);
      }
    };

    if (pet.model === 'frog') {
      addPart(1.2, 0.65, 1.35, '#50c96f', 0, 0.3, 0);
      addPart(0.92, 0.55, 0.92, '#73eb86', 0, 0.62, 0.48);
      addPart(0.78, 0.24, 0.78, '#c8ffd0', 0, 0.28, 0.28);
      addPart(0.28, 0.28, 0.28, '#efffff', -0.24, 0.95, 0.62);
      addPart(0.28, 0.28, 0.28, '#efffff', 0.24, 0.95, 0.62);
      addPart(0.22, 0.16, 0.22, '#2f4f3f', -0.24, 0.95, 0.74);
      addPart(0.22, 0.16, 0.22, '#2f4f3f', 0.24, 0.95, 0.74);
      addPart(0.12, 0.08, 0.08, '#ffffff', -0.3, 1.02, 0.84);
      addPart(0.12, 0.08, 0.08, '#ffffff', 0.18, 1.02, 0.84);
      addPair(0.18, 0.08, 0.06, '#ff9fc2', 0.38, 0.58, 0.86);
      addPart(0.46, 0.07, 0.06, '#22523b', 0, 0.5, 0.94);
      addBodySpots([
        [-0.42, 0.66, 0.02, 0.18, 0.18],
        [0.36, 0.55, -0.18, 0.14, 0.14],
        [-0.18, 0.2, -0.45, 0.16, 0.16],
        [0.26, 0.18, 0.12, 0.12, 0.12]
      ], '#2aa95a');
      addPart(0.28, 0.16, 0.5, '#7fe98c', -0.42, 0.05, 0.5);
      addPart(0.28, 0.16, 0.5, '#7fe98c', 0.42, 0.05, 0.5);
      addPart(0.34, 0.16, 0.45, '#7fe98c', -0.35, 0.05, -0.48);
      addPart(0.34, 0.16, 0.45, '#7fe98c', 0.35, 0.05, -0.48);
      addPair(0.16, 0.06, 0.24, '#c8ffd0', 0.52, 0.0, 0.78, 0, 0.25, 0);
      addPair(0.18, 0.06, 0.22, '#c8ffd0', 0.48, 0.0, -0.72, 0, -0.25, 0);
    } else if (pet.model === 'deer') {
      addPart(1.45, 0.78, 0.75, '#b98458', 0, 0.55, 0);
      addPart(1.0, 0.28, 0.78, '#efd0ad', 0, 0.42, 0.18);
      addPart(0.72, 0.72, 0.68, '#d4a47d', 0, 0.95, 0.78);
      addEyePair(0.22, 1.03, 1.14, 0.16);
      addPart(0.24, 0.16, 0.11, '#2f1d14', 0, 0.88, 1.2);
      addPart(0.28, 0.08, 0.08, '#3b2419', 0, 0.76, 1.21);
      addPair(0.22, 0.42, 0.16, '#b98458', 0.42, 1.16, 0.82, 0, 0, 0.38);
      addPair(0.16, 0.32, 0.1, '#f2c99f', 0.42, 1.16, 0.88, 0, 0, 0.38);
      addPart(0.2, 0.9, 0.2, '#9b6a45', -0.52, -0.05, 0.22);
      addPart(0.2, 0.9, 0.2, '#9b6a45', 0.52, -0.05, 0.22);
      addPart(0.2, 0.9, 0.2, '#9b6a45', -0.52, -0.05, -0.22);
      addPart(0.2, 0.9, 0.2, '#9b6a45', 0.52, -0.05, -0.22);
      addPair(0.24, 0.12, 0.24, '#2b1a12', 0.52, -0.54, 0.22);
      addPair(0.24, 0.12, 0.24, '#2b1a12', 0.52, -0.54, -0.22);
      addPart(0.14, 0.62, 0.14, '#f7e1b1', -0.22, 1.48, 0.96, -0.15, 0, 0.2);
      addPart(0.14, 0.62, 0.14, '#f7e1b1', 0.22, 1.48, 0.96, -0.15, 0, -0.2);
      addPart(0.52, 0.16, 0.14, '#f7e1b1', -0.34, 1.75, 0.98, 0, 0, 0.45);
      addPart(0.52, 0.16, 0.14, '#f7e1b1', 0.34, 1.75, 0.98, 0, 0, -0.45);
      addPair(0.36, 0.12, 0.12, '#f7e1b1', 0.48, 1.58, 0.98, 0, 0, 0.8);
      addPair(0.3, 0.1, 0.1, '#f7e1b1', 0.56, 1.9, 0.98, 0, 0, 0.2);
      addPart(0.2, 0.22, 0.48, '#fff6e1', 0, 0.84, 1.16);
      addPart(0.26, 0.26, 0.22, '#fff6e1', 0, 0.72, -0.5);
      addBodySpots([
        [-0.42, 0.82, 0.05, 0.16, 0.16],
        [0.18, 0.9, -0.18, 0.14, 0.14],
        [0.5, 0.68, 0.16, 0.12, 0.12],
        [-0.1, 0.65, -0.28, 0.12, 0.12]
      ], '#fff0c7');
    } else if (pet.model === 'cow') {
      addPart(1.6, 0.95, 0.92, '#fffef8', 0, 0.62, 0);
      addPart(0.82, 0.7, 0.82, '#f5f1ea', 0, 0.9, 0.92);
      addPart(0.86, 0.35, 0.45, '#ffbcb3', 0, 0.55, 1.18);
      addEyePair(0.26, 1.0, 1.34, 0.16);
      addPair(0.08, 0.08, 0.06, '#5b2f2a', 0.2, 0.55, 1.44);
      addPart(0.28, 0.06, 0.06, '#5b2f2a', 0, 0.42, 1.42);
      addPair(0.34, 0.45, 0.12, '#f5f1ea', 0.55, 1.05, 0.9, 0, 0, 0.42);
      addPair(0.16, 0.38, 0.12, '#f4dfa5', 0.32, 1.36, 0.92, -0.28, 0, 0.25);
      addPart(0.2, 1.0, 0.2, '#4c2b1f', -0.56, -0.08, 0.24);
      addPart(0.2, 1.0, 0.2, '#4c2b1f', 0.56, -0.08, 0.24);
      addPart(0.2, 1.0, 0.2, '#4c2b1f', -0.56, -0.08, -0.24);
      addPart(0.2, 1.0, 0.2, '#4c2b1f', 0.56, -0.08, -0.24);
      addPair(0.26, 0.14, 0.26, '#241611', 0.56, -0.63, 0.24);
      addPair(0.26, 0.14, 0.26, '#241611', 0.56, -0.63, -0.24);
      addPart(0.22, 0.28, 0.12, '#674b3b', -0.26, 1.28, 0.86);
      addPart(0.22, 0.28, 0.12, '#674b3b', 0.26, 1.28, 0.86);
      addPart(0.42, 0.22, 0.18, '#413028', -0.3, 0.76, 0.05);
      addPart(0.36, 0.18, 0.16, '#413028', 0.32, 0.4, -0.12);
      addPart(0.46, 0.28, 0.2, '#413028', 0.4, 0.82, -0.24);
      addPart(0.28, 0.28, 0.2, '#413028', -0.42, 0.36, 0.3);
      addPart(0.56, 0.22, 0.44, '#ffbcb3', 0, 0.15, -0.02);
      addPair(0.08, 0.16, 0.08, '#d47f8a', 0.16, 0.0, 0.02);
      addPart(0.14, 0.14, 0.78, '#4c2b1f', 0, 0.75, -0.78, 0.82);
      addPart(0.28, 0.28, 0.16, '#413028', 0, 0.38, -1.12);
    } else if (pet.model === 'tiger') {
      addPart(1.46, 0.72, 0.72, '#ff9936', 0, 0.52, 0);
      addPart(0.78, 0.66, 0.72, '#ffb566', 0, 0.88, 0.82);
      addPart(0.56, 0.28, 0.16, '#fff0d0', 0, 0.72, 1.16);
      addEyePair(0.23, 0.98, 1.18, 0.16, '#0f2217');
      addPart(0.18, 0.12, 0.09, '#201008', 0, 0.78, 1.28);
      addPart(0.34, 0.06, 0.07, '#201008', 0, 0.64, 1.27);
      addPart(0.18, 0.26, 0.12, '#25150c', -0.28, 1.25, 0.86);
      addPart(0.18, 0.26, 0.12, '#25150c', 0.28, 1.25, 0.86);
      addPair(0.2, 0.3, 0.12, '#ffb566', 0.38, 1.2, 0.82, 0, 0, 0.45);
      addPart(0.18, 0.82, 0.18, '#553117', -0.5, -0.02, 0.22);
      addPart(0.18, 0.82, 0.18, '#553117', 0.5, -0.02, 0.22);
      addPart(0.18, 0.82, 0.18, '#553117', -0.5, -0.02, -0.22);
      addPart(0.18, 0.82, 0.18, '#553117', 0.5, -0.02, -0.22);
      addPair(0.26, 0.12, 0.26, '#f5e9cf', 0.5, -0.48, 0.22);
      addPair(0.26, 0.12, 0.26, '#f5e9cf', 0.5, -0.48, -0.22);
      addPart(0.18, 0.18, 1.18, '#25150c', -0.22, 0.54, -0.02);
      addPart(0.18, 0.18, 1.18, '#25150c', 0.22, 0.54, -0.02);
      addPart(0.18, 0.18, 1.0, '#25150c', 0, 0.54, 0.06);
      addPair(0.12, 0.17, 1.1, '#25150c', 0.48, 0.72, -0.02, 0, 0.15, 0.45);
      addPair(0.1, 0.16, 0.7, '#25150c', 0.3, 0.95, 0.84, 0, 0.12, 0.34);
      addPart(0.2, 0.2, 1.15, '#25150c', 0, 0.72, -0.92, 0.75);
      addPart(0.26, 0.24, 0.28, '#ff9936', 0, 0.34, -1.38, 0.75);
      addPair(0.08, 0.08, 0.22, '#ffffff', 0.21, -0.42, 0.44);
      addPair(0.08, 0.08, 0.22, '#ffffff', 0.21, -0.42, -0.08);
    } else if (pet.model === 'lion') {
      addPart(1.48, 0.8, 0.84, '#d6a052', 0, 0.56, 0);
      addPart(1.2, 1.08, 1.06, '#5c3b1f', 0, 1.04, 0.84);
      addPart(0.76, 0.74, 0.74, '#f0c26e', 0, 1.02, 0.96);
      addPart(1.34, 0.22, 0.96, '#73451f', 0, 1.42, 0.78);
      addPart(1.34, 0.22, 0.96, '#73451f', 0, 0.66, 0.78);
      addPair(0.28, 0.84, 0.88, '#73451f', 0.58, 1.04, 0.78);
      addEyePair(0.22, 1.1, 1.3, 0.16, '#1f1509');
      addPart(0.48, 0.26, 0.14, '#fff0d1', 0, 0.86, 1.28);
      addPart(0.18, 0.13, 0.1, '#24150b', 0, 0.96, 1.36);
      addPart(0.32, 0.06, 0.07, '#24150b', 0, 0.74, 1.35);
      addPart(0.2, 0.86, 0.2, '#7b5527', -0.5, -0.04, 0.24);
      addPart(0.2, 0.86, 0.2, '#7b5527', 0.5, -0.04, 0.24);
      addPart(0.2, 0.86, 0.2, '#7b5527', -0.5, -0.04, -0.24);
      addPart(0.2, 0.86, 0.2, '#7b5527', 0.5, -0.04, -0.24);
      addPair(0.28, 0.13, 0.28, '#f4d18a', 0.5, -0.5, 0.24);
      addPair(0.28, 0.13, 0.28, '#f4d18a', 0.5, -0.5, -0.24);
      addPart(0.18, 0.28, 0.18, '#2a170e', -0.24, 1.42, 0.98);
      addPart(0.18, 0.28, 0.18, '#2a170e', 0.24, 1.42, 0.98);
      addPair(0.22, 0.32, 0.12, '#d6a052', 0.42, 1.38, 0.94, 0, 0, 0.45);
      addPart(0.22, 0.22, 1.2, '#5c3b1f', 0, 0.84, -1.02, 0.95);
      addPart(0.38, 0.38, 0.28, '#5c3b1f', 0, 0.34, -1.42);
      addPair(0.08, 0.08, 0.22, '#fff6dd', 0.22, -0.48, 0.44);
      addPair(0.08, 0.08, 0.22, '#fff6dd', 0.22, -0.48, -0.08);
    } else if (pet.model === 'dragon') {
      addPart(1.8, 0.82, 0.86, '#6f6cff', 0, 0.75, 0);
      addPart(0.92, 0.78, 0.78, '#8b88ff', 0, 1.15, 0.96);
      addPart(1.18, 0.24, 0.58, '#b8f1ff', 0, 0.66, 0.18);
      addEyePair(0.24, 1.28, 1.34, 0.18, '#071124');
      addPair(0.08, 0.08, 0.08, '#071124', 0.16, 1.08, 1.38);
      addPart(0.24, 0.12, 0.09, '#071124', 0, 1.02, 1.42);
      addPair(0.1, 0.24, 0.08, '#fff8d6', 0.18, 0.9, 1.42, 0.25);
      addPart(0.24, 0.42, 0.18, '#ffe67b', -0.22, 1.7, 1.02, -0.35);
      addPart(0.24, 0.42, 0.18, '#ffe67b', 0.22, 1.7, 1.02, -0.35);
      addPair(0.28, 0.18, 0.12, '#ffe67b', 0.36, 1.54, 1.0, -0.22, 0, 0.55);
      addPart(1.2, 0.1, 0.5, '#3940b8', -0.96, 1.08, 0.24, 0.15, 0.2, 0.35);
      addPart(1.2, 0.1, 0.5, '#3940b8', 0.96, 1.08, 0.24, 0.15, -0.2, -0.35);
      addPart(1.05, 0.12, 0.46, '#89dfff', -0.96, 1.05, 0.24, 0.15, 0.2, 0.35);
      addPart(1.05, 0.12, 0.46, '#89dfff', 0.96, 1.05, 0.24, 0.15, -0.2, -0.35);
      addPair(0.08, 0.08, 0.72, '#3940b8', 1.0, 1.07, 0.24, 0.15, 0.2, 0.35);
      addPart(0.24, 0.9, 0.24, '#4c49c5', -0.58, 0.02, 0.2);
      addPart(0.24, 0.9, 0.24, '#4c49c5', 0.58, 0.02, 0.2);
      addPart(0.24, 0.9, 0.24, '#4c49c5', -0.58, 0.02, -0.2);
      addPart(0.24, 0.9, 0.24, '#4c49c5', 0.58, 0.02, -0.2);
      addPair(0.28, 0.14, 0.28, '#b8f1ff', 0.58, -0.5, 0.2);
      addPair(0.28, 0.14, 0.28, '#b8f1ff', 0.58, -0.5, -0.2);
      addPart(0.28, 0.28, 1.5, '#7e7bff', 0, 0.9, -1.18, 0.75);
      addPart(0.18, 0.18, 0.8, '#5f5cff', 0, 0.54, -1.8, 0.75);
      addBackSpikes(6, -0.72, 0.32, 1.25, '#ffe67b', 0.18);
      addBodySpots([
        [-0.45, 1.02, 0.1, 0.18, 0.18],
        [0.42, 0.86, -0.14, 0.16, 0.16],
        [-0.22, 0.76, -0.34, 0.14, 0.14],
        [0.2, 1.28, 0.68, 0.12, 0.12]
      ], '#514eff');
    }

    group.scale.setScalar(preview ? 1.08 : 0.92);
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return group;
  }

  function createPetDock(position, withButtons = false) {
    const group = new THREE.Group();
    group.position.copy(position);
    scene.add(group);

    const baseMat = new THREE.MeshToonMaterial({ color: '#f8e3b8' });
    const pillarMat = new THREE.MeshToonMaterial({ color: '#ffe8c8' });
    const trimMat = new THREE.MeshToonMaterial({ color: '#ff915f' });
    const upgradeMat = new THREE.MeshToonMaterial({ color: '#5ddb76' });
    const sellMat = new THREE.MeshToonMaterial({ color: '#ff6868' });

    const base = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.8, 6.2), baseMat);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.2), pillarMat);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 3.2), trimMat);
    const upgradeButton = withButtons ? new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 1.05), upgradeMat) : null;
    const sellButton = withButtons ? new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 1.05), sellMat) : null;
    const previewAnchor = new THREE.Group();
    const infoCard = new THREE.Mesh(
      new THREE.PlaneGeometry(4.9, 2.15),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.96, side: THREE.DoubleSide })
    );

    base.position.y = 0.4;
    pillar.position.y = 1.5;
    top.position.y = 2.55;
    previewAnchor.position.y = 3.35;
    infoCard.position.set(0, 2.3, 0);
    if (upgradeButton) upgradeButton.position.set(2.2, 1.35, 0);
    if (sellButton) sellButton.position.set(-2.2, 1.35, 0);
    infoCard.visible = false;

    for (const part of [base, pillar, top, upgradeButton, sellButton].filter(Boolean)) {
      part.castShadow = true;
      part.receiveShadow = true;
    }

    previewAnchor.add(infoCard);
    group.add(base, pillar, top, previewAnchor);
    if (upgradeButton) group.add(upgradeButton);
    if (sellButton) group.add(sellButton);
    return { group, pedestal: top, previewAnchor, infoCard, upgradeButton, sellButton };
  }

  const housePetDockPositions = [8, 12, 16, 20, 24].map((z) => housePoint(-13.2, 0, z));
  const showcaseGoldMat = new THREE.MeshToonMaterial({ color: '#ffe76a', emissive: '#ffe76a', emissiveIntensity: 0.22 });
  const housePetDocks = housePetDockPositions.map((position, index) => {
    const dock = createPetDock(position, false);
    dock.previewScale = index === BEST_SHOWCASE_DOCK_INDEX ? 2.25 : 1.18;
    dock.cardLift = index === BEST_SHOWCASE_DOCK_INDEX ? 2.35 : 0;
    dock.isBestShowcase = index === BEST_SHOWCASE_DOCK_INDEX;
    if (dock.isBestShowcase) {
      const trophyRing = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.11, 6, 32), showcaseGoldMat);
      trophyRing.rotation.x = Math.PI / 2;
      trophyRing.position.y = 2.95;
      trophyRing.castShadow = true;
      const crownA = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.92, 0.46), showcaseGoldMat);
      const crownB = crownA.clone();
      const crownC = crownA.clone();
      crownA.position.set(-0.62, 4.1, 0);
      crownB.position.set(0, 4.32, 0);
      crownC.position.set(0.62, 4.1, 0);
      dock.group.add(trophyRing, crownA, crownB, crownC);
    }
    clickablePetButtons.push({ mesh: dock.pedestal, kind: 'home-place', anchor: dock.group, index });
    return dock;
  });
  const housePetDock = housePetDocks[0];
  const petStation = createPetDock(housePoint(-8.6, 0, 27), true);
  clickablePetButtons.push(
    { mesh: petStation.pedestal, kind: 'place', anchor: petStation.group },
    { mesh: petStation.upgradeButton, kind: 'upgrade', anchor: petStation.group },
    { mesh: petStation.sellButton, kind: 'sell', anchor: petStation.group }
  );

  const housePetDockStates = housePetDocks.map(() => ({ preview: null, card: null }));
  const petStationState = { preview: null, card: null };
  let activePetMesh = null;
  let petBob = Math.random() * Math.PI * 2;

  function refreshDockPreview(dock, state, pet, labelText = pet.label) {
    if (state.preview) {
      dock.previewAnchor.remove(state.preview);
      state.preview = null;
    }
    if (state.card) {
      state.card.dispose();
      state.card = null;
    }
    const visible = pet.key !== 'none';
    dock.group.visible = true;
    dock.infoCard.visible = visible;
    if (dock.upgradeButton) dock.upgradeButton.visible = visible;
    if (dock.sellButton) dock.sellButton.visible = visible;
    if (!visible) {
      dock.infoCard.material.map = null;
      dock.infoCard.material.needsUpdate = true;
      return;
    }
    state.preview = buildPetModel(pet.key, true);
    state.preview.scale.multiplyScalar(dock.previewScale || 1.18);
    dock.previewAnchor.add(state.preview);
    dock.infoCard.position.set(0, (PET_CARD_HEIGHTS[pet.key] ?? 2.15) + (dock.cardLift || 0), 0);
    state.card = createPetCardTexture(
      labelText,
      getPetRarityLabel(pet.key),
      getPetLevel(pet.key),
      getPetIncomePerSecond(pet.key, getPetLevel(pet.key))
    );
    dock.infoCard.material.map = state.card;
    dock.infoCard.material.needsUpdate = true;
  }

  function refreshHousePetDocks() {
    housePetDocks.forEach((dock, index) => {
      const pet = dock.isBestShowcase ? getBestOwnedPet() : getPlacedPet(index);
      refreshDockPreview(
        dock,
        housePetDockStates[index],
        pet,
        dock.isBestShowcase
          ? (pet.key === 'none' ? 'Best Pet Showcase' : `${pet.label} Champion`)
          : (pet.key === 'none' ? `Pet Base ${index + 1}` : `${pet.label} Base ${index + 1}`)
      );
    });
  }

  function refreshPetStation() {
    const pet = getBestOwnedPet();
    refreshDockPreview(
      petStation,
      petStationState,
      pet,
      pet.key === 'none' ? 'No Best Pet' : `${pet.label} Best`
    );
  }

  function refreshAllPetDocks() {
    refreshHousePetDocks();
    refreshPetStation();
  }

  function mountActivePet() {
    if (activePetMesh) {
      scene.remove(activePetMesh);
      activePetMesh = null;
    }
    const pet = getActivePet();
    refreshAllPetDocks();
    if (pet.key === 'none') return;
    activePetMesh = buildPetModel(pet.key, false);
    scene.add(activePetMesh);
  }

  function buildLootMesh(rarity) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.8), new THREE.MeshToonMaterial({ color: '#ffffff' }));
    const idolMaterial = new THREE.MeshToonMaterial({ color: rarity.color, emissive: rarity.color, emissiveIntensity: 0.38 });
    const idol = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.1), idolMaterial);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), idolMaterial);
    base.position.y = 0.35;
    idol.position.y = 1.25;
    top.position.y = 2.15;
    top.rotation.y = Math.PI / 4;
    for (const part of [base, idol, top]) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
    group.add(base, idol, top);
    return group;
  }

  function buildPetPickupMesh(pet, section) {
    const group = new THREE.Group();
    const model = buildPetModel(pet.key, true);
    model.position.y = 0.78;
    model.scale.multiplyScalar(1.18);
    group.add(model);
    group.userData.model = model;
    group.userData.shadowPulse = 0.8 + (section.tierIndex % 3) * 0.05;
    return group;
  }

  function setActorCarryingPet(actor, petData) {
    if (actor.petCarryMesh) {
      actor.group.remove(actor.petCarryMesh);
      actor.petCarryMesh = null;
    }
    actor.carryingPet = petData || null;
    if (!petData) return;
    const mesh = buildPetModel(petData.pet.key, true);
    mesh.scale.setScalar(0.62);
    mesh.position.set(0, 3.95, 0.08);
    actor.group.add(mesh);
    actor.petCarryMesh = mesh;
  }

  function dropCarriedPet(actor, reason = '') {
    if (!actor.carryingPet) return false;
    const { pet, section } = actor.carryingPet;
    const dropPos = actor.group.position.clone();
    dropPos.x += THREE.MathUtils.randFloatSpread(2.4);
    dropPos.z += THREE.MathUtils.randFloatSpread(2.4);
    spawnPetPickupAt(section, pet, dropPos.x, dropPos.z, { droppedBySword: true });
    setActorCarryingPet(actor, null);
    if (reason) showToast(reason);
    return true;
  }

  function spawnPetPickupAt(section, pet, x, z, extraData = {}) {
    const mesh = buildPetPickupMesh(pet, section);
    mesh.position.set(x, 0.1, z);
    mesh.userData.pet = pet;
    mesh.userData.section = section;
    mesh.userData.bob = Math.random() * Math.PI * 2;
    mesh.userData.spin = Math.random() * Math.PI * 2;
    Object.assign(mesh.userData, extraData);
    scene.add(mesh);
    petPickups.push(mesh);
    return mesh;
  }

  function getSectionPetPool(section, lockedOnly = false) {
    return PET_TYPES.filter((pet) => {
      if (pet.key === 'none') return false;
      if (!petEligibleForTier(pet, section.tier.key)) return false;
      if (lockedOnly && saveState.unlockedPets.includes(pet.key)) return false;
      return true;
    });
  }

  function chooseLootRarity(section) {
    const minIndex = Math.max(0, section.tierIndex - 2);
    const candidates = RARITY_TIERS.slice(minIndex, section.tierIndex + 1);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function getNearbySpawnSections() {
    ensureSectionsAhead(player.group.position.z);
    const behind = player.group.position.z - (SECTION_LENGTH + GAP_LENGTH) * 2;
    const ahead = player.group.position.z + (SECTION_LENGTH + GAP_LENGTH) * 12;
    const pool = sections.filter((section) => section.end >= behind && section.start <= ahead);
    return pool.length ? pool : sections;
  }

  function spawnLoot() {
    if (lootItems.length >= WORLD.maxLoot) return;
    const nearbySections = getNearbySpawnSections();
    const section = nearbySections[Math.floor(Math.random() * nearbySections.length)];
    const rarity = chooseLootRarity(section);
    const x = THREE.MathUtils.randFloatSpread(WORLD.laneWidth - 7);
    const z = THREE.MathUtils.randFloat(section.start + 1.2, section.end - 1.2);
    const mesh = buildLootMesh(rarity);
    mesh.position.set(x, 0.2, z);
    mesh.userData = { rarity, section, spin: Math.random() * Math.PI * 2, bob: Math.random() * Math.PI * 2 };
    scene.add(mesh);
    lootItems.push(mesh);
  }

  function spawnPetPickup() {
    if (petPickups.length >= PET_PICKUP_LIMIT) return;
    const nearbySections = getNearbySpawnSections();
    const eligibleSections = nearbySections.filter((section) => getSectionPetPool(section).length > 0);
    if (!eligibleSections.length) return;
    const lockedSections = eligibleSections.filter((section) => getSectionPetPool(section, true).length > 0);
    const sectionPool = lockedSections.length ? lockedSections : eligibleSections;
    const section = sectionPool[Math.floor(Math.random() * sectionPool.length)];
    const petPool = getSectionPetPool(section, lockedSections.length > 0);
    if (!petPool.length) return;
    const pet = petPool[Math.floor(Math.random() * petPool.length)];
    spawnPetPickupAt(
      section,
      pet,
      THREE.MathUtils.randFloatSpread(WORLD.laneWidth - 8),
      THREE.MathUtils.randFloat(section.start + 1, section.end - 1)
    );
  }

  function cleanupDistantPickups() {
    const minZ = player.group.position.z - 150;
    for (let i = lootItems.length - 1; i >= 0; i--) {
      if (lootItems[i].position.z < minZ) {
        scene.remove(lootItems[i]);
        lootItems.splice(i, 1);
      }
    }
    for (let i = petPickups.length - 1; i >= 0; i--) {
      if (petPickups[i].position.z < minZ) {
        scene.remove(petPickups[i]);
        petPickups.splice(i, 1);
      }
    }
  }

  function ensureCheatBossDragon() {
    if (!saveState.startBossDragonCheat) return;
    if (petPickups.some((pickup) => pickup.userData.cheatId === 'start-boss-dragon')) return;
    const firstSection = sections[0];
    const dragon = petByKey.get('dragon');
    spawnPetPickupAt(firstSection, dragon, 0, firstSection.start + 2.2, { cheatId: 'start-boss-dragon' });
  }

  for (let i = 0; i < 12; i++) spawnLoot();
  for (let i = 0; i < PET_PICKUP_LIMIT; i++) spawnPetPickup();
  ensureCheatBossDragon();

  function createShop(position, label, cost, apply, previewFactory = null, actionLabel = 'Upgrade') {
    const group = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 1.1, 6), new THREE.MeshToonMaterial({ color: '#ffb457' }));
    const icon = previewFactory
      ? previewFactory()
      : new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ color: '#fff6d8', emissive: '#fff1a8', emissiveIntensity: 0.55 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.16, 10, 24), new THREE.MeshToonMaterial({ color: '#ff895c' }));
    pad.position.y = 0.35;
    icon.position.y = 2.4;
    ring.position.y = 1.85;
    ring.rotation.x = Math.PI / 2;
    group.add(pad, icon, ring);
    group.position.copy(position);
    scene.add(group);
    shops.push({ group, position, label, cost, apply, icon, ring, actionLabel });
    bobbers.push({ mesh: icon, speed: 1.8, offset: Math.random() * Math.PI * 2, amount: 0.18 });
  }

  createShop(new THREE.Vector3(18, 0, 12), 'Speed +1', SPEED_UPGRADE_COST, () => {
    gameState.speedLevel += 1;
    queueSave('Speed upgrade saved.');
    showToast('Speed upgraded. Your permanent profile moved faster.');
  });

  createShop(new THREE.Vector3(25, 0, 12), 'Dash +0.5s', 75, () => {
    gameState.dashMax += 0.5;
    gameState.dashEnergy = Math.min(gameState.dashEnergy + 0.5, gameState.dashMax);
    queueSave('Dash upgrade saved.');
    showToast('Dash tank upgraded. This is now part of your permanent save.');
  });

  function chooseCostume(costume) {
    saveState.costumeKey = costume.key;
    applyCharacterCostume(player, costume.key);
    queueSave(`${costume.label} costume saved.`);
    showToast(`Wearing ${costume.label}. Costume saved permanently.`);
  }

  function buildCostumeShopSign() {
    const group = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(12.5, 2.2, 0.45), new THREE.MeshToonMaterial({ color: '#fff4c2' }));
    const trim = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.28, 0.55), new THREE.MeshToonMaterial({ color: '#ff8f6b' }));
    const poleA = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), new THREE.MeshToonMaterial({ color: '#8a5530' }));
    const poleB = poleA.clone();
    board.position.y = 3.1;
    trim.position.y = 4.35;
    poleA.position.set(-5.7, 1.5, 0);
    poleB.position.set(5.7, 1.5, 0);
    group.add(board, trim, poleA, poleB);
    group.position.set(-33, 0, 16);
    scene.add(group);
    return group;
  }

  buildCostumeShopSign();

  COSTUMES.forEach((costume, index) => {
    const x = -47 + (index % 3) * 7;
    const z = 10 + Math.floor(index / 3) * 7;
    createShop(
      new THREE.Vector3(x, 0, z),
      `Costume: ${costume.label}`,
      costume.cost,
      () => chooseCostume(costume),
      () => buildCostumePreview(costume),
      'Wear'
    );
  });

  function buildWeaponShopSign() {
    const group = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(12.5, 2.2, 0.45), new THREE.MeshToonMaterial({ color: '#dff6ff' }));
    const trim = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.28, 0.55), new THREE.MeshToonMaterial({ color: '#7fdcff' }));
    const bladeIcon = buildWeaponModel(weaponByKey.get('boss_sword'), true);
    const poleA = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), new THREE.MeshToonMaterial({ color: '#30556d' }));
    const poleB = poleA.clone();
    board.position.y = 3.1;
    trim.position.y = 4.35;
    bladeIcon.position.set(0, 3.2, 0.45);
    bladeIcon.scale.setScalar(0.45);
    bladeIcon.rotation.z = -0.65;
    poleA.position.set(-5.7, 1.5, 0);
    poleB.position.set(5.7, 1.5, 0);
    group.add(board, trim, bladeIcon, poleA, poleB);
    group.position.set(33, 0, 16);
    scene.add(group);
    return group;
  }

  buildWeaponShopSign();

  WEAPONS.filter((weapon) => weapon.key !== 'none').forEach((weapon, index) => {
    createShop(
      new THREE.Vector3(35 + (index % 2) * 7, 0, 9 + Math.floor(index / 2) * 7),
      `Weapon: ${weapon.label}`,
      weapon.cost,
      () => equipWeapon(weapon.key, true),
      () => buildWeaponModel(weapon, true),
      'Equip'
    );
  });

  const shopHint = document.createElement('div');
  shopHint.className = 'shop-hint';
  document.body.appendChild(shopHint);
  const ecoHint = document.createElement('div');
  ecoHint.className = 'shop-hint';
  document.body.appendChild(ecoHint);
  let activeShopTarget = null;

  function buyShopUpgrade(shop) {
    if (!shop) return false;
    if (gameState.banked >= shop.cost) {
      gameState.banked -= shop.cost;
      shop.apply();
    } else {
      showToast('Not enough banked loot for that upgrade.');
    }
    return true;
  }

  function setCarry(actor, rarity) {
    actor.carrying = rarity;
    actor.bones.carryVisual.visible = Boolean(rarity);
    if (rarity) {
      actor.bones.carryVisual.children[1].material = new THREE.MeshToonMaterial({
        color: rarity.color,
        emissive: rarity.color,
        emissiveIntensity: 0.55
      });
    }
  }

  function refreshPlayerIdentity() {
    player.name = saveState.name;
    ui.playerName.textContent = saveState.name;
    ui.nameInput.value = saveState.name;
    nameSign.update(saveState.name);
    refreshProfileCard();
  }

  refreshPlayerIdentity();
  mountActivePet();
  equipWeapon(saveState.weaponKey, false);

  const displaySellButtonMat = new THREE.MeshToonMaterial({ color: '#ff3f3f', emissive: '#ff1616', emissiveIntensity: 0.28 });
  for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
    const button = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), displaySellButtonMat);
    button.position.copy(displaySlots[i]).add(new THREE.Vector3(0, 2.35, 0));
    button.visible = false;
    button.castShadow = true;
    scene.add(button);
    displaySellButtons[i] = button;
    clickablePetButtons.push({ mesh: button, kind: 'sell-loot', index: i, anchor: { position: displaySlots[i] }, range: 28 });
  }

  function populateDisplaySlot(index, rarityKey) {
    const old = displayItems[index];
    if (old) {
      scene.remove(old);
      displayItems[index] = null;
    }
    if (displaySellButtons[index]) displaySellButtons[index].visible = false;
    if (!rarityKey || !rarityByKey.has(rarityKey)) return;
    const rarity = rarityByKey.get(rarityKey);
    const mesh = buildLootMesh(rarity);
    mesh.scale.setScalar(0.7);
    mesh.position.copy(displaySlots[index]).add(new THREE.Vector3(0, 0.35, 0));
    mesh.rotation.y = (index % 2) * 0.35;
    scene.add(mesh);
    displayItems[index] = mesh;
    if (displaySellButtons[index]) {
      displaySellButtons[index].position.copy(displaySlots[index]).add(new THREE.Vector3(0, 2.35, 0));
      displaySellButtons[index].visible = true;
    }
  }

  for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
    populateDisplaySlot(i, saveState.collection[i]);
  }

  function placeLootInHouse(rarity) {
    const freeIndex = saveState.collection.findIndex((entry) => !entry);
    if (freeIndex === -1) return false;
    saveState.collection[freeIndex] = rarity.key;
    populateDisplaySlot(freeIndex, rarity.key);
    queueSave('House collection saved.');
    return true;
  }

  function sellHouseLootSlot(index) {
    const rarityKey = saveState.collection[index];
    const rarity = rarityByKey.get(rarityKey);
    if (!rarity) {
      showToast('That old display slot is already empty.');
      return;
    }
    gameState.banked += rarity.value;
    saveState.collection[index] = null;
    populateDisplaySlot(index, null);
    queueSave(`${rarity.label} display sold.`);
    showToast(`Sold old ${rarity.label} display for ${rarity.value}. Space freed for better loot.`);
  }

  function commitPlayerName() {
    const nextName = (ui.nameInput.value || '').trim().slice(0, 18) || 'Player';
    saveState.name = nextName;
    saveState.profileNameSet = true;
    refreshPlayerIdentity();
    queueSave('Name saved permanently.');
    showToast(`Profile name set to ${nextName}.`);
  }

  ui.saveNameButton.addEventListener('click', commitPlayerName);
  ui.nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commitPlayerName();
  });
  ui.bulkUpgradePet.addEventListener('input', refreshBulkUpgradePanel);
  ui.bulkUpgradeLevel.addEventListener('input', refreshBulkUpgradePanel);
  ui.bulkUpgradeConfirm.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    confirmBulkUpgrade();
  });
  ui.bulkUpgradeClose.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleBulkUpgradePanel(false);
  });
  document.querySelector('.bulk-upgrade-card').addEventListener('click', (event) => event.stopPropagation());
  ui.bulkUpgradePanel.addEventListener('click', (event) => {
    if (event.target === ui.bulkUpgradePanel) toggleBulkUpgradePanel(false);
  });
  ui.bulkUpgradeLevel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') confirmBulkUpgrade();
  });
  ui.bulkUpgradePet.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') confirmBulkUpgrade();
  });
  ui.battleMatch.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startPetBattleMatch();
  });
  ui.battleClose.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setBattlePanel(false);
  });
  ui.battlePanel.addEventListener('click', (event) => {
    if (event.target === ui.battlePanel) setBattlePanel(false);
  });

  function claimPet(pet, section) {
    const isNew = !saveState.unlockedPets.includes(pet.key);
    if (isNew) {
      saveState.unlockedPets.push(pet.key);
    }
    saveState.petLevels[pet.key] = Math.max(1, saveState.petLevels[pet.key] || 1);
    clearPlacedPetKey(pet.key);
    saveState.petKey = pet.key;
    mountActivePet();
    queueSave(isNew ? `${pet.label} saved to your profile.` : 'Pet selection saved.');
    showToast(
      isNew
        ? `${pet.label} unlocked from ${section.tier.label} tier and is now following you.`
        : `${pet.label} switched in from ${section.tier.label} tier.`
    );
  }

  function placeActivePetOnHomeDock(index = 0) {
    const activePet = getActivePet();
    const dock = housePetDocks[index] || housePetDocks[0];
    if (dock.isBestShowcase) {
      const bestPet = getBestOwnedPet();
      showToast(bestPet.key === 'none'
        ? 'The middle trophy base is automatic. Unlock a strong pet and it will appear here.'
        : `The middle trophy base automatically shows your best pet: ${bestPet.label}.`);
      return;
    }
    const dockPet = getPlacedPet(index);
    if (activePet.key === 'none' && dockPet.key === 'none') {
      showToast('Bring a real modeled pet home first, then place it on one of the five pet bases.');
      return;
    }
    if (player.group.position.distanceTo(dock.group.position) > 10) {
      showToast('Step near that pet base to manage it.');
      return;
    }

    if (activePet.key === 'none' && dockPet.key !== 'none') {
      saveState.petKey = dockPet.key;
      saveState.placedPetKeys[index] = null;
      syncPlacedPetLegacyKey();
      mountActivePet();
      queueSave(`${dockPet.label} picked up from pet base ${index + 1}.`);
      showToast(`${dockPet.label} is back with you now.`);
      return;
    }

    if (dockPet.key === 'none') {
      clearPlacedPetKey(activePet.key);
      saveState.placedPetKeys[index] = activePet.key;
      saveState.petKey = 'none';
      syncPlacedPetLegacyKey();
      mountActivePet();
      queueSave(`${activePet.label} placed on pet base ${index + 1}.`);
      showToast(`${activePet.label} is now resting on pet base ${index + 1}.`);
      return;
    }

    clearPlacedPetKey(activePet.key);
    saveState.placedPetKeys[index] = activePet.key;
    saveState.petKey = dockPet.key;
    syncPlacedPetLegacyKey();
    mountActivePet();
    queueSave(`Pet base ${index + 1} updated.`);
    showToast(`${activePet.label} was placed down, and ${dockPet.label} was picked back up.`);
  }

  function placeActivePetOnStation() {
    const pet = getBestOwnedPet();
    if (pet.key === 'none') {
      showToast('Unlock a pet first, then the outside pedestal will show your best one.');
      return;
    }
    if (player.group.position.distanceTo(petStation.group.position) > 10) {
      showToast('Head over to the outside pedestal to view your strongest pet.');
      return;
    }
    showToast(`${pet.label} is your strongest pet, so it is already displayed outside.`);
  }

  function upgradeActivePet() {
    const pet = getBestOwnedPet();
    if (pet.key === 'none') {
      showToast('Unlock a pet first, then use the outside pedestal to upgrade your strongest one.');
      return;
    }
    const level = getPetLevel(pet.key);
    const cost = getPetUpgradeCost(pet.key, level);
    if (gameState.banked < cost) {
      showToast(`${pet.label} upgrade costs ${cost}.`);
      return;
    }
    gameState.banked -= cost;
    saveState.petLevels[pet.key] = level + 1;
    refreshPetStation();
    queueSave(`${pet.label} level saved.`);
    showToast(`${pet.label} reached Lv.${level + 1} and now earns ${formatPetIncome(getPetIncomePerSecond(pet.key, level + 1))}/s.`);
  }

  function sellActivePet() {
    const pet = getBestOwnedPet();
    if (pet.key === 'none') {
      showToast('Unlock a pet first, then use the outside pedestal to sell it.');
      return;
    }
    const level = getPetLevel(pet.key);
    const value = getPetSellValue(pet.key, level);
    gameState.banked += value;
    saveState.unlockedPets = saveState.unlockedPets.filter((key) => key !== pet.key);
    if (!saveState.unlockedPets.includes('none')) {
      saveState.unlockedPets.unshift('none');
    }
    saveState.petLevels[pet.key] = 1;
    if (saveState.petKey === pet.key) saveState.petKey = 'none';
    clearPlacedPetKey(pet.key);
    mountActivePet();
    queueSave(`${pet.label} sale saved.`);
    showToast(`Sold ${pet.label} for ${value}.`);
  }

  function stealLoot(thief, victim) {
    if (!victim.carrying || thief.carrying || thief.stealCooldown > 0 || victim.stealCooldown > 0) return;
    setCarry(thief, victim.carrying);
    setCarry(victim, null);
    thief.stealCooldown = 1;
    victim.stealCooldown = 1;
    victim.stun = 0.5;
    const shove = victim.group.position.clone().sub(thief.group.position).setY(0).normalize().multiplyScalar(7.5);
    victim.velocity.add(shove);
    thief.velocity.addScaledVector(shove, -0.35);
    if (thief.isPlayer || victim.isPlayer) {
      showToast(thief.isPlayer ? `You stole a ${thief.carrying.key} idol.` : `${victim.name} stole your loot.`);
    }
  }

  function dropCarriedLoot(actor, reason = '') {
    if (!actor.carrying) return false;
    const rarity = actor.carrying;
    const mesh = buildLootMesh(rarity);
    mesh.position.copy(actor.group.position).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(2.6), -0.85, THREE.MathUtils.randFloatSpread(2.6)));
    mesh.userData = {
      rarity,
      section: getSectionForZ(actor.group.position.z),
      spin: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
      droppedBySword: true
    };
    scene.add(mesh);
    lootItems.push(mesh);
    setCarry(actor, null);
    if (reason) showToast(reason);
    return true;
  }

  function bankLoot(actor) {
    if (!actor.carrying || actor.group.position.z > WORLD.homeDepth - 4) return;
    if (actor.isPlayer) {
      const rarity = actor.carrying;
      const pet = getActivePet();
      const gain = Math.round(rarity.value * pet.bankMultiplier);
      gameState.banked += gain;
      const placed = placeLootInHouse(rarity);
      showToast(placed
        ? `Banked +${gain} and placed ${rarity.key} into your house.`
        : `Banked +${gain}, but your 16 house slots are full. Click a red button over old loot to sell it.`);
      queueSave('Profile progress saved.');
    } else {
      gameState.rivalBanked += actor.carrying.value;
    }
    setCarry(actor, null);
  }

  function bankCarriedPet(actor) {
    if (!actor.carryingPet || actor.group.position.z > WORLD.homeDepth - 4) return;
    if (actor.isPlayer) {
      claimPet(actor.carryingPet.pet, actor.carryingPet.section);
    } else {
      gameState.rivalBanked += actor.carryingPet.pet.incomePerSecond * 40;
    }
    setActorCarryingPet(actor, null);
  }

  function respawnActor(actor, reason) {
    setCarry(actor, null);
    setActorCarryingPet(actor, null);
    actor.velocity.set(0, 0, 0);
    actor.verticalVelocity = 0;
    actor.grounded = true;
    actor.stun = 0.5;
    actor.group.position.set(actor.respawnX, actor.baseY, 12 + Math.random() * 3);
    if (actor.isPlayer && reason) {
      showToast(reason);
    }
  }

  function horizontalDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function removeActivePet(reason = 'Your active pet was lost.') {
    const pet = getActivePet();
    if (pet.key === 'none') return;
    saveState.petKey = 'none';
    saveState.unlockedPets = saveState.unlockedPets.filter((key) => key !== pet.key);
    if (!saveState.unlockedPets.includes('none')) saveState.unlockedPets.unshift('none');
    saveState.petLevels[pet.key] = 1;
    mountActivePet();
    queueSave('Active pet lost to disaster.');
    showToast(reason);
  }

  function removePetPickupsInRadius(center, radius) {
    for (let i = petPickups.length - 1; i >= 0; i--) {
      if (horizontalDistance(petPickups[i].position, center) <= radius) {
        scene.remove(petPickups[i]);
        petPickups.splice(i, 1);
      }
    }
  }

  function removeLootInRadius(center, radius) {
    for (let i = lootItems.length - 1; i >= 0; i--) {
      if (horizontalDistance(lootItems[i].position, center) <= radius) {
        scene.remove(lootItems[i]);
        lootItems.splice(i, 1);
      }
    }
  }

  function randomHazardCenter(near = 24, far = 170) {
    return new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(Math.max(18, WORLD.laneWidth - 22)),
      0,
      player.group.position.z + THREE.MathUtils.randFloat(near, far)
    );
  }

  function createHazardBlast(center, radius, color = '#ff6a2a', duration = 0.55) {
    const blast = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.25, radius, 1.2, 24),
      new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 0.55, transparent: true, opacity: 0.72 })
    );
    blast.position.set(center.x, 0.65, center.z);
    scene.add(blast);
    meteorBlasts.push({ mesh: blast, timer: duration, maxTimer: duration });
    return blast;
  }

  function addTemporaryHazardVisual(group, timer = 0.5) {
    scene.add(group);
    temporaryHazardVisuals.push({ group, timer });
  }

  function damageActorsAndPets(center, radius, playerMessage, petMessage) {
    for (const actor of actors) {
      if (horizontalDistance(actor.group.position, center) <= radius) {
        respawnActor(actor, actor.isPlayer ? playerMessage : null);
      }
    }
    if (activePetMesh && horizontalDistance(activePetMesh.position, center) <= radius) {
      removeActivePet(petMessage);
    }
    removePetPickupsInRadius(center, radius);
    removeLootInRadius(center, radius);
  }

  function shoveActorsFrom(center, radius, strength, extraStun = 0.35) {
    for (const actor of actors) {
      const offset = actor.group.position.clone().sub(center).setY(0);
      const dist = offset.length();
      if (dist > 0 && dist < radius) {
        actor.velocity.add(offset.normalize().multiplyScalar((1 - dist / radius) * strength));
        actor.stun = Math.max(actor.stun, extraStun);
      }
    }
  }

  function createDelayedHazard({ center, radius, delay = 1.4, color = '#ff4427', onImpact }) {
    const group = new THREE.Group();
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, depthWrite: false })
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.76, radius, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.74, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    ring.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.1;
    ring.position.y = 0.13;
    group.position.copy(center);
    group.add(shadow, ring);
    scene.add(group);
    delayedHazards.push({ group, shadow, ring, center: center.clone(), radius, timer: delay, maxTimer: delay, color, onImpact });
  }

  function createLightningVisual(center) {
    const group = new THREE.Group();
    const boltMat = new THREE.MeshBasicMaterial({ color: '#fff36d', transparent: true, opacity: 0.92 });
    for (let i = 0; i < 5; i++) {
      const segment = new THREE.Mesh(new THREE.BoxGeometry(0.38, 7.5, 0.38), boltMat);
      segment.position.set((i - 2) * 0.55, 3.7 + i * 2.5, (i % 2 ? 0.4 : -0.35));
      segment.rotation.z = (i % 2 ? 0.28 : -0.28);
      group.add(segment);
    }
    group.position.set(center.x, 0.2, center.z);
    addTemporaryHazardVisual(group, 0.34);
  }

  function createFirePatch(center) {
    const group = new THREE.Group();
    const baseMat = new THREE.MeshToonMaterial({ color: '#3a2417', transparent: true, opacity: 0.72 });
    const flameMats = [
      new THREE.MeshToonMaterial({ color: '#ff4128', emissive: '#ff2a13', emissiveIntensity: 0.8 }),
      new THREE.MeshToonMaterial({ color: '#ff8b28', emissive: '#ff5b13', emissiveIntensity: 0.65 }),
      new THREE.MeshToonMaterial({ color: '#ffd46d', emissive: '#ffb13a', emissiveIntensity: 0.5 })
    ];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 0.18, 12), baseMat);
    base.position.y = 0.12;
    group.add(base);
    for (let i = 0; i < 9; i++) {
      const flame = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.0 + Math.random() * 1.2, 0.75), flameMats[i % flameMats.length]);
      flame.position.set(THREE.MathUtils.randFloatSpread(6), 1.0 + Math.random() * 0.8, THREE.MathUtils.randFloatSpread(6));
      flame.rotation.y = Math.random() * Math.PI;
      group.add(flame);
    }
    group.position.set(center.x, 0, center.z);
    scene.add(group);
    firePatches.push({ group, center: center.clone(), radius: 6.2, timer: 12, hitTimer: 0, offset: Math.random() * Math.PI * 2 });
  }

  function createLandslideBlock(
    side,
    z,
    color = '#b67944',
    playerMessage = 'A landslide swept you away.',
    petMessage = 'Your active pet was buried by a landslide.'
  ) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(12, 4.2, 6.8),
      new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 0.12 })
    );
    block.position.set(side * (WORLD.laneWidth / 2 + 12), 2.1, z);
    block.castShadow = true;
    block.receiveShadow = true;
    block.userData = { side, speed: 35 + Math.random() * 11, radius: 7.2, playerMessage, petMessage };
    scene.add(block);
    landslideBlocks.push(block);
  }

  function getDisasterSpeedMultiplier() {
    let multiplier = 1;
    if (disasterEffects.rainTimer > 0) multiplier *= RAIN_SPEED_MULTIPLIER;
    if (disasterEffects.acidRainTimer > 0) multiplier *= 0.82;
    if (disasterEffects.hailTimer > 0) multiplier *= 0.72;
    if (disasterEffects.heatTimer > 0) multiplier *= 0.82;
    if (disasterEffects.sandTimer > 0) multiplier *= 0.78;
    if (disasterEffects.blizzardTimer > 0) multiplier *= 0.64;
    if (disasterEffects.floodTimer > 0) multiplier *= 0.55;
    if (disasterEffects.quakeTimer > 0) multiplier *= 0.84;
    return multiplier;
  }

  function getDisasterStatusLabel() {
    const active = [];
    if (gameState.calmOceanTimer > 0) active.push('calm ocean');
    if (meteorWarnings.length || delayedHazards.length) active.push('danger circles');
    if (disasterEffects.thunderTimer > 0) active.push('lightning');
    if (disasterEffects.tornadoTimer > 0) active.push('tornado pull');
    if (disasterEffects.wildfireTimer > 0) active.push('wildfire');
    if (disasterEffects.landslideTimer > 0 || landslideBlocks.length) active.push('landslide');
    if (disasterEffects.windTimer > 0) active.push('wild wind');
    if (disasterEffects.floodTimer > 0) active.push('flood slow');
    if (disasterEffects.blizzardTimer > 0) active.push('blizzard');
    if (disasterEffects.sandTimer > 0) active.push('sandstorm');
    if (disasterEffects.fogTimer > 0) active.push('fog');
    if (disasterEffects.rainTimer > 0) active.push('rain slow');
    if (disasterEffects.acidRainTimer > 0) active.push('acid rain');
    if (disasterEffects.hailTimer > 0) active.push('hail');
    if (disasterEffects.heatTimer > 0) active.push('heatwave');
    if (disasterEffects.quakeTimer > 0) active.push('earthquake');
    return active.length ? active.slice(0, 3).join(', ') : 'watch the sky, sea, and volcanoes';
  }

  function clearWaves() {
    for (const wave of waves) scene.remove(wave);
    waves.length = 0;
  }

  function updateCalmOcean(delta) {
    if (gameState.calmOceanTimer > 0) {
      gameState.calmOceanTimer = Math.max(0, gameState.calmOceanTimer - delta);
      clearWaves();
      if (gameState.calmOceanTimer === 0) {
        showToast('The ocean is moving again. Watch for the next tsunami.');
      }
      return;
    }

    gameState.calmCheckTimer += delta;
    while (gameState.calmCheckTimer >= 1) {
      gameState.calmCheckTimer -= 1;
      if (Math.random() < 0.1) {
        gameState.calmOceanTimer = 10;
        gameState.nextWave = Math.max(gameState.nextWave, 10);
        clearWaves();
        showToast('Calm Ocean! No tsunami can spawn for 10 seconds.');
        break;
      }
    }
  }

  function createWave() {
    if (gameState.calmOceanTimer > 0) return;
    ensureSectionsAhead(player.group.position.z + 120);
    const group = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD.laneWidth + 9, 8.5, 5.5),
      new THREE.MeshPhongMaterial({
        color: '#79f4ff',
        emissive: '#38bdf8',
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.72,
        shininess: 110
      })
    );
    wall.position.y = 2.8;
    group.add(wall);

    for (let i = 0; i < 14; i++) {
      const foam = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshToonMaterial({ color: '#ffffff' })
      );
      foam.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth + 3), 5 + Math.random() * 2.8, THREE.MathUtils.randFloatSpread(2.8));
      group.add(foam);
    }

    group.position.set(0, 0, Math.max(WORLD.length + 18, player.group.position.z + 160));
    group.userData = { speed: 24 + gameState.waveCount * 0.9 };
    scene.add(group);
    waves.push(group);
    gameState.waveCount += 1;
    showToast('TSUNAMI! Hide in a gap or sprint home.');
  }

  function updateWave(delta) {
    for (let i = waves.length - 1; i >= 0; i--) {
      const wave = waves[i];
      wave.position.z -= wave.userData.speed * delta;
      for (const child of wave.children.slice(1)) {
        child.position.y += Math.sin(clock.elapsedTime * 8 + child.position.x) * 0.01;
      }

      for (const actor of actors) {
        const safe = actor.group.position.z < WORLD.homeDepth - 2 || inWaveShelter(actor);
        const close = Math.abs(wave.position.z - actor.group.position.z) < 3.6;
        if (!safe && close) {
          respawnActor(actor, 'The tsunami swept you back to your home dock.');
        }
      }

      if (wave.position.z < -18) {
        scene.remove(wave);
        waves.splice(i, 1);
      }
    }
  }

  function createMeteorWarning(center, sourceVolcano = null) {
    const group = new THREE.Group();
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(METEOR_IMPACT_RADIUS, 40),
      volcanoMaterials.warning.clone()
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(METEOR_IMPACT_RADIUS * 0.82, METEOR_IMPACT_RADIUS, 40),
      volcanoMaterials.warningRing.clone()
    );
    const meteor = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.2, 0),
      volcanoMaterials.meteor
    );
    shadow.rotation.x = -Math.PI / 2;
    ring.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.08;
    ring.position.y = 0.11;
    const startX = sourceVolcano ? sourceVolcano.group.position.x : center.x + THREE.MathUtils.randFloatSpread(45);
    meteor.position.set(startX - center.x, 72, -36);
    meteor.rotation.set(0.4, 0.7, 0.2);
    group.add(shadow, ring, meteor);
    group.position.set(center.x, 0, center.z);
    scene.add(group);
    meteorWarnings.push({
      group,
      shadow,
      ring,
      meteor,
      center: center.clone(),
      timer: METEOR_WARNING_SECONDS,
      maxTimer: METEOR_WARNING_SECONDS
    });
  }

  function triggerVolcanoEruption() {
    renderVolcanoesUntil(player.group.position.z + 280);
    const nearbyVolcanoes = volcanoes.filter((volcano) => Math.abs(volcano.group.position.z - player.group.position.z) < 260);
    const source = nearbyVolcanoes.length
      ? nearbyVolcanoes[Math.floor(Math.random() * nearbyVolcanoes.length)]
      : volcanoes[Math.floor(Math.random() * volcanoes.length)];
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const center = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(WORLD.laneWidth - 18),
        0,
        player.group.position.z + THREE.MathUtils.randFloat(28, 170)
      );
      createMeteorWarning(center, source);
    }
    showToast('Volcano eruption! Red shadows mark meteor impacts in 3 seconds.');
  }

  function triggerWindStorm() {
    const pushBack = DISASTER_WIND_SECTION_KNOCKBACK * (SECTION_LENGTH + GAP_LENGTH);
    for (const actor of actors) {
      actor.group.position.z = Math.max(WORLD.spawnBackZ + 6, actor.group.position.z - pushBack);
      actor.velocity.z -= 32;
      actor.stun = Math.max(actor.stun, 0.55);
      clampActor(actor);
    }
    disasterEffects.windTimer = 4.5;
    disasterEffects.windPulse = 1;
    showToast('Wild Wind! Everyone was blown back 20 sections.');
  }

  function triggerRainStorm() {
    disasterEffects.rainTimer = 12;
    showToast('Heavy Rain! Movement speed is reduced by 50%.');
  }

  function triggerAcidRain() {
    disasterEffects.acidRainTimer = 10;
    disasterEffects.acidTick = 1;
    showToast('Acid Rain! You move slower and carried loot may dissolve.');
  }

  function triggerThunderstorm() {
    disasterEffects.thunderTimer = 9;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const center = randomHazardCenter(16 + i * 14, 140 + i * 8);
      createDelayedHazard({
        center,
        radius: HAZARD_DAMAGE_RADIUS,
        delay: 1.1 + Math.random() * 0.8,
        color: '#fff36d',
        onImpact: () => {
          createLightningVisual(center);
          createHazardBlast(center, HAZARD_DAMAGE_RADIUS, '#fff36d', 0.34);
          damageActorsAndPets(center, HAZARD_DAMAGE_RADIUS, 'Lightning struck you. Watch the yellow warning circles.', 'Your active pet was struck by lightning.');
        }
      });
    }
    showToast('Thunderstorm! Yellow circles warn where lightning will hit.');
  }

  function triggerHailStorm() {
    disasterEffects.hailTimer = 10;
    for (let i = 0; i < 4; i++) {
      const center = randomHazardCenter(26 + i * 12, 150 + i * 8);
      createDelayedHazard({
        center,
        radius: HAZARD_DAMAGE_RADIUS * 0.78,
        delay: 1.6 + Math.random() * 1.2,
        color: '#dffcff',
        onImpact: () => {
          createHazardBlast(center, HAZARD_DAMAGE_RADIUS * 0.78, '#dffcff', 0.38);
          damageActorsAndPets(center, HAZARD_DAMAGE_RADIUS * 0.78, 'Giant hail knocked you out.', 'Your active pet was crushed by hail.');
        }
      });
    }
    showToast('Hailstorm! Icy chunks slow movement and crash into marked spots.');
  }

  function triggerHeatWave() {
    disasterEffects.heatTimer = 12;
    gameState.dashEnergy = Math.max(0, gameState.dashEnergy - 0.8);
    showToast('Heat Wave! Speed drops and sprint energy burns away faster.');
  }

  function triggerFogBank() {
    disasterEffects.fogTimer = 11;
    showToast('Dense Fog! Visibility is low. Use the crosshair and stay centered.');
  }

  function triggerSandstorm() {
    disasterEffects.sandTimer = 11;
    showToast('Sandstorm! Vision and movement are reduced.');
  }

  function triggerBlizzard() {
    disasterEffects.blizzardTimer = 12;
    showToast('Blizzard! Heavy snow makes movement slippery and slow.');
  }

  function triggerFlood() {
    disasterEffects.floodTimer = 11;
    showToast('Flash Flood! Water drags everyone backward and cuts speed.');
  }

  function triggerEarthquake() {
    disasterEffects.quakeTimer = 5.5;
    disasterEffects.quakePulse = 1.3;
    for (const actor of actors) {
      actor.velocity.x += THREE.MathUtils.randFloatSpread(20);
      actor.velocity.z += THREE.MathUtils.randFloatSpread(14);
      actor.stun = Math.max(actor.stun, 0.28);
    }
    showToast('Earthquake! The ground shakes and throws everyone off balance.');
  }

  function triggerTornado() {
    disasterEffects.tornadoTimer = 10;
    tornadoGroup.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth * 0.55), 0, player.group.position.z + 58);
    showToast('Tornado! Stay away from the funnel or it will pull you in.');
  }

  function triggerWildfire() {
    disasterEffects.wildfireTimer = 12;
    for (let i = 0; i < 6; i++) {
      createFirePatch(randomHazardCenter(22 + i * 10, 150 + i * 8));
    }
    showToast('Wildfire! Burning patches destroy creatures and pickups inside them.');
  }

  function triggerLandslide() {
    disasterEffects.landslideTimer = 8;
    for (let i = 0; i < 4; i++) {
      createLandslideBlock(Math.random() > 0.5 ? 1 : -1, player.group.position.z + 34 + i * 24 + Math.random() * 12);
    }
    showToast('Landslide! Brown rock walls sweep across the course.');
  }

  function triggerAvalanche() {
    disasterEffects.landslideTimer = 8;
    disasterEffects.blizzardTimer = Math.max(disasterEffects.blizzardTimer, 6);
    for (let i = 0; i < 5; i++) {
      createLandslideBlock(
        Math.random() > 0.5 ? 1 : -1,
        player.group.position.z + 28 + i * 20 + Math.random() * 10,
        '#f3fbff',
        'An avalanche buried you in snow.',
        'Your active pet was buried by an avalanche.'
      );
    }
    showToast('Avalanche! White snow walls slide across the lane.');
  }

  function triggerHurricane() {
    disasterEffects.rainTimer = Math.max(disasterEffects.rainTimer, 12);
    disasterEffects.windTimer = Math.max(disasterEffects.windTimer, 7);
    disasterEffects.windPulse = 1.25;
    disasterEffects.floodTimer = Math.max(disasterEffects.floodTimer, 7);
    for (const actor of actors) {
      actor.velocity.x += THREE.MathUtils.randFloatSpread(28);
      actor.velocity.z -= 12 + Math.random() * 12;
    }
    showToast('Hurricane! Rain, floodwater, and side wind hit at the same time.');
  }

  function triggerIceStorm() {
    disasterEffects.hailTimer = Math.max(disasterEffects.hailTimer, 11);
    disasterEffects.blizzardTimer = Math.max(disasterEffects.blizzardTimer, 8);
    for (let i = 0; i < 5; i++) {
      const center = randomHazardCenter(20 + i * 12, 152 + i * 8);
      createDelayedHazard({
        center,
        radius: HAZARD_DAMAGE_RADIUS * 0.72,
        delay: 1.2 + Math.random() * 1.0,
        color: '#bdf7ff',
        onImpact: () => {
          createHazardBlast(center, HAZARD_DAMAGE_RADIUS * 0.72, '#bdf7ff', 0.38);
          damageActorsAndPets(center, HAZARD_DAMAGE_RADIUS * 0.72, 'Ice storm shards knocked you out.', 'Your active pet was hit by ice storm shards.');
        }
      });
    }
    showToast('Ice Storm! Slippery cold and marked ice impacts are active.');
  }

  function triggerDrought() {
    disasterEffects.heatTimer = Math.max(disasterEffects.heatTimer, 16);
    gameState.dashEnergy = 0;
    showToast('Drought! Sprint energy dries out and heat slows everyone.');
  }

  function triggerColdWave() {
    disasterEffects.blizzardTimer = Math.max(disasterEffects.blizzardTimer, 12);
    disasterEffects.hailTimer = Math.max(disasterEffects.hailTimer, 6);
    showToast('Cold Wave! The lane freezes into a long slow zone.');
  }

  function triggerStormSurge() {
    disasterEffects.floodTimer = Math.max(disasterEffects.floodTimer, 13);
    if (gameState.calmOceanTimer <= 0) gameState.nextWave = Math.min(gameState.nextWave, 3.5);
    showToast('Storm Surge! Floodwater drags you back and a tsunami may arrive soon.');
  }

  function triggerRandomDisaster() {
    const disasters = [
      triggerVolcanoEruption,
      triggerWindStorm,
      triggerRainStorm,
      triggerAcidRain,
      triggerThunderstorm,
      triggerHailStorm,
      triggerHeatWave,
      triggerFogBank,
      triggerSandstorm,
      triggerBlizzard,
      triggerFlood,
      triggerEarthquake,
      triggerTornado,
      triggerWildfire,
      triggerLandslide,
      triggerAvalanche,
      triggerHurricane,
      triggerIceStorm,
      triggerDrought,
      triggerColdWave,
      triggerStormSurge
    ];
    disasters[Math.floor(Math.random() * disasters.length)]();
    gameState.nextDisaster = 9 + Math.random() * 8;
  }

  function applyMeteorImpact(warning) {
    const center = warning.center;
    const blast = new THREE.Mesh(
      new THREE.CylinderGeometry(METEOR_IMPACT_RADIUS * 0.35, METEOR_IMPACT_RADIUS, 1.4, 24),
      new THREE.MeshToonMaterial({ color: '#ff6a2a', emissive: '#ff3b12', emissiveIntensity: 0.7, transparent: true, opacity: 0.75 })
    );
    blast.position.set(center.x, 0.7, center.z);
    scene.add(blast);
    meteorBlasts.push({ mesh: blast, timer: 0.55, maxTimer: 0.55 });

    for (const actor of actors) {
      if (horizontalDistance(actor.group.position, center) <= METEOR_IMPACT_RADIUS) {
        respawnActor(actor, actor.isPlayer ? 'A meteor crushed you. Watch the shadow circles.' : null);
      }
    }
    if (activePetMesh && horizontalDistance(activePetMesh.position, center) <= METEOR_IMPACT_RADIUS) {
      removeActivePet('Your active pet was crushed by a meteor.');
    }
    removePetPickupsInRadius(center, METEOR_IMPACT_RADIUS);
    removeLootInRadius(center, METEOR_IMPACT_RADIUS);
  }

  function updateDisasters(delta) {
    disasterEffects.rainTimer = Math.max(0, disasterEffects.rainTimer - delta);
    disasterEffects.acidRainTimer = Math.max(0, disasterEffects.acidRainTimer - delta);
    disasterEffects.windTimer = Math.max(0, disasterEffects.windTimer - delta);
    disasterEffects.windPulse = Math.max(0, disasterEffects.windPulse - delta * 0.8);
    disasterEffects.hailTimer = Math.max(0, disasterEffects.hailTimer - delta);
    disasterEffects.heatTimer = Math.max(0, disasterEffects.heatTimer - delta);
    disasterEffects.fogTimer = Math.max(0, disasterEffects.fogTimer - delta);
    disasterEffects.sandTimer = Math.max(0, disasterEffects.sandTimer - delta);
    disasterEffects.blizzardTimer = Math.max(0, disasterEffects.blizzardTimer - delta);
    disasterEffects.floodTimer = Math.max(0, disasterEffects.floodTimer - delta);
    disasterEffects.thunderTimer = Math.max(0, disasterEffects.thunderTimer - delta);
    disasterEffects.tornadoTimer = Math.max(0, disasterEffects.tornadoTimer - delta);
    disasterEffects.quakeTimer = Math.max(0, disasterEffects.quakeTimer - delta);
    disasterEffects.quakePulse = Math.max(0, disasterEffects.quakePulse - delta * 0.7);
    disasterEffects.wildfireTimer = Math.max(0, disasterEffects.wildfireTimer - delta);
    disasterEffects.landslideTimer = Math.max(0, disasterEffects.landslideTimer - delta);

    const acidActive = disasterEffects.acidRainTimer > 0;
    rainGroup.visible = disasterEffects.rainTimer > 0 || acidActive;
    windGroup.visible = disasterEffects.windTimer > 0;
    hailGroup.visible = disasterEffects.hailTimer > 0;
    sandGroup.visible = disasterEffects.sandTimer > 0;
    snowGroup.visible = disasterEffects.blizzardTimer > 0;
    fogGroup.visible = disasterEffects.fogTimer > 0 || disasterEffects.sandTimer > 0 || disasterEffects.blizzardTimer > 0;
    floodGroup.visible = disasterEffects.floodTimer > 0;
    tornadoGroup.visible = disasterEffects.tornadoTimer > 0;

    rainMaterial.color.set(acidActive ? '#b8ff7a' : '#aee8ff');
    rainMaterial.opacity = acidActive ? 0.72 : 0.62;
    if (rainGroup.visible) {
      for (const drop of rainGroup.children) {
        drop.position.y -= delta * (acidActive ? 28 : 24);
        drop.position.z -= delta * (acidActive ? 12 : 9);
        if (drop.position.y < 0.8) {
          drop.position.y = 18 + Math.random() * 10;
          drop.position.x = THREE.MathUtils.randFloatSpread(WORLD.laneWidth);
          drop.position.z = THREE.MathUtils.randFloatSpread(150);
        }
      }
      rainGroup.position.set(0, 0, player.group.position.z + 48);
    }
    if (windGroup.visible) {
      for (const gust of windGroup.children) {
        gust.position.x -= delta * (45 + disasterEffects.windPulse * 25);
        if (gust.position.x < -WORLD.laneWidth / 2) {
          gust.position.x = WORLD.laneWidth / 2 + Math.random() * 30;
          gust.position.z = THREE.MathUtils.randFloatSpread(130);
          gust.position.y = 3 + Math.random() * 8;
        }
      }
      windGroup.position.set(0, 0, player.group.position.z + 28);
    }
    if (hailGroup.visible) {
      for (const hail of hailGroup.children) {
        hail.position.y -= delta * 34;
        hail.position.z -= delta * 13;
        hail.rotation.x += delta * 7;
        hail.rotation.z += delta * 5;
        if (hail.position.y < 0.6) {
          hail.position.y = 18 + Math.random() * 12;
          hail.position.x = THREE.MathUtils.randFloatSpread(WORLD.laneWidth);
          hail.position.z = THREE.MathUtils.randFloatSpread(145);
        }
      }
      hailGroup.position.set(0, 0, player.group.position.z + 50);
    }
    if (sandGroup.visible) {
      for (const sheet of sandGroup.children) {
        sheet.position.x -= delta * 24;
        sheet.position.z -= delta * 8;
        if (sheet.position.x < -WORLD.laneWidth / 2 - 20) {
          sheet.position.x = WORLD.laneWidth / 2 + Math.random() * 28;
          sheet.position.z = THREE.MathUtils.randFloatSpread(140);
        }
      }
      sandGroup.position.set(0, 0, player.group.position.z + 48);
    }
    if (snowGroup.visible) {
      for (const flake of snowGroup.children) {
        flake.position.y -= delta * 9;
        flake.position.x += Math.sin(clock.elapsedTime * 2 + flake.position.z) * delta * 2.5;
        flake.position.z -= delta * 3.5;
        if (flake.position.y < 0.55) {
          flake.position.y = 16 + Math.random() * 12;
          flake.position.x = THREE.MathUtils.randFloatSpread(WORLD.laneWidth);
          flake.position.z = THREE.MathUtils.randFloatSpread(145);
        }
      }
      snowGroup.position.set(0, 0, player.group.position.z + 46);
    }
    if (fogGroup.visible) {
      fogGroup.position.set(0, 0, player.group.position.z + 56);
      for (const sheet of fogGroup.children) {
        sheet.position.x += Math.sin(clock.elapsedTime * 0.6 + sheet.position.z) * delta * 0.7;
        sheet.material.opacity = disasterEffects.sandTimer > 0 ? 0.16 : disasterEffects.blizzardTimer > 0 ? 0.2 : 0.27;
      }
      scene.fog.near = disasterEffects.sandTimer > 0 ? 18 : 24;
      scene.fog.far = disasterEffects.sandTimer > 0 ? 74 : disasterEffects.blizzardTimer > 0 ? 90 : 105;
      scene.fog.color.set(disasterEffects.sandTimer > 0 ? '#e8c57b' : '#e7fbff');
    } else {
      scene.fog.near = 70;
      scene.fog.far = Math.max(WORLD.length + 130, player.group.position.z + 260);
      scene.fog.color.set('#9de6ff');
    }
    if (floodGroup.visible) {
      floodGroup.position.set(0, 0, player.group.position.z + 48);
      floodSheet.material.opacity = 0.28 + Math.sin(clock.elapsedTime * 4) * 0.04;
      for (const actor of actors) {
        actor.velocity.z -= delta * 7.5;
      }
    }
    if (disasterEffects.heatTimer > 0) {
      gameState.dashEnergy = Math.max(0, gameState.dashEnergy - delta * 0.22);
      oceanMaterial.emissive.set('#3fc6e8');
    } else {
      oceanMaterial.emissive.set('#21a7e4');
    }
    if (acidActive) {
      disasterEffects.acidTick -= delta;
      if (disasterEffects.acidTick <= 0) {
        disasterEffects.acidTick = 1;
        if (player.carrying && Math.random() < 0.35) {
          setCarry(player, null);
          showToast('Acid rain dissolved the loot you were carrying.');
        }
      }
    }
    if (tornadoGroup.visible) {
      tornadoGroup.rotation.y += delta * 3.6;
      tornadoGroup.position.z += delta * 12;
      tornadoGroup.position.x += Math.sin(clock.elapsedTime * 1.4) * delta * 12;
      if (tornadoGroup.position.z > player.group.position.z + 125) {
        tornadoGroup.position.set(THREE.MathUtils.randFloatSpread(WORLD.laneWidth * 0.6), 0, player.group.position.z + 38);
      }
      for (const actor of actors) {
        const offset = tornadoGroup.position.clone().sub(actor.group.position).setY(0);
        const dist = offset.length();
        if (dist > 0 && dist < 24) {
          actor.velocity.add(offset.normalize().multiplyScalar((24 - dist) * delta * 5.2));
          actor.stun = Math.max(actor.stun, 0.08);
          if (dist < 4.8) respawnActor(actor, actor.isPlayer ? 'The tornado swallowed you and threw you home.' : null);
        }
      }
      if (activePetMesh && horizontalDistance(activePetMesh.position, tornadoGroup.position) < 5.2) {
        removeActivePet('Your active pet was pulled into the tornado.');
      }
    }
    if (disasterEffects.quakeTimer > 0) {
      const quakeStrength = 2.2 * (0.35 + disasterEffects.quakePulse);
      for (const actor of actors) {
        actor.velocity.x += THREE.MathUtils.randFloatSpread(quakeStrength) * delta;
        actor.velocity.z += THREE.MathUtils.randFloatSpread(quakeStrength) * delta;
      }
    }

    gameState.nextDisaster -= delta;
    if (gameState.nextDisaster <= 0) triggerRandomDisaster();

    for (const volcano of volcanoes) {
      const t = clock.elapsedTime + volcano.offset;
      volcano.crater.scale.setScalar(1 + Math.sin(t * 2.8) * 0.08);
      volcano.smokeBase.position.y = Math.sin(t * 1.1) * 0.8;
      volcano.smokeBase.rotation.y += delta * 0.18;
    }

    for (let i = meteorWarnings.length - 1; i >= 0; i--) {
      const warning = meteorWarnings[i];
      warning.timer -= delta;
      const progress = 1 - Math.max(0, warning.timer / warning.maxTimer);
      warning.ring.rotation.z += delta * 4.8;
      warning.ring.scale.setScalar(1 + Math.sin(clock.elapsedTime * 12) * 0.08);
      warning.shadow.material.opacity = 0.26 + progress * 0.35;
      warning.meteor.position.lerp(new THREE.Vector3(0, 2.7, 0), 0.045 + progress * 0.06);
      warning.meteor.rotation.x += delta * 4.2;
      warning.meteor.rotation.z += delta * 3.7;
      if (warning.timer <= 0) {
        applyMeteorImpact(warning);
        scene.remove(warning.group);
        meteorWarnings.splice(i, 1);
      }
    }

    for (let i = delayedHazards.length - 1; i >= 0; i--) {
      const hazard = delayedHazards[i];
      hazard.timer -= delta;
      const progress = 1 - Math.max(0, hazard.timer / hazard.maxTimer);
      hazard.ring.rotation.z += delta * 5.6;
      hazard.ring.scale.setScalar(1 + Math.sin(clock.elapsedTime * 14) * 0.08);
      hazard.shadow.material.opacity = 0.18 + progress * 0.36;
      if (hazard.timer <= 0) {
        hazard.onImpact?.();
        scene.remove(hazard.group);
        delayedHazards.splice(i, 1);
      }
    }

    for (let i = meteorBlasts.length - 1; i >= 0; i--) {
      const blast = meteorBlasts[i];
      blast.timer -= delta;
      blast.mesh.scale.multiplyScalar(1 + delta * 4);
      blast.mesh.material.opacity = Math.max(0, blast.timer / (blast.maxTimer || 0.55));
      if (blast.timer <= 0) {
        scene.remove(blast.mesh);
        meteorBlasts.splice(i, 1);
      }
    }

    for (let i = temporaryHazardVisuals.length - 1; i >= 0; i--) {
      const visual = temporaryHazardVisuals[i];
      visual.timer -= delta;
      visual.group.traverse((child) => {
        if (child.isMesh && child.material) child.material.opacity = Math.max(0, visual.timer / 0.5);
      });
      if (visual.timer <= 0) {
        scene.remove(visual.group);
        temporaryHazardVisuals.splice(i, 1);
      }
    }

    for (let i = firePatches.length - 1; i >= 0; i--) {
      const patch = firePatches[i];
      patch.timer -= delta;
      patch.hitTimer -= delta;
      patch.group.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5 + patch.offset) * 0.04);
      patch.group.children.forEach((child, index) => {
        if (index > 0) child.position.y = 1.1 + Math.abs(Math.sin(clock.elapsedTime * 4 + index)) * 0.9;
      });
      if (patch.hitTimer <= 0) {
        patch.hitTimer = 0.55;
        damageActorsAndPets(patch.center, patch.radius, 'Wildfire burned you. Avoid the flame patches.', 'Your active pet was caught in wildfire.');
      }
      if (patch.timer <= 0) {
        scene.remove(patch.group);
        firePatches.splice(i, 1);
      }
    }

    for (let i = landslideBlocks.length - 1; i >= 0; i--) {
      const block = landslideBlocks[i];
      block.position.x -= block.userData.side * block.userData.speed * delta;
      block.rotation.y += delta * block.userData.side * 0.7;
      damageActorsAndPets(block.position, block.userData.radius, block.userData.playerMessage, block.userData.petMessage);
      if (Math.abs(block.position.x) > WORLD.laneWidth / 2 + 26) {
        scene.remove(block);
        landslideBlocks.splice(i, 1);
      }
    }
  }

  function chooseLootTarget(bot) {
    if (!lootItems.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const loot of lootItems) {
      const dist = bot.group.position.distanceTo(loot.position);
      const score = loot.userData.rarity.value * 2.4 - dist + Math.random() * 9;
      if (score > bestScore) {
        bestScore = score;
        best = loot;
      }
    }
    return best;
  }

  function inWaveShelter(actor) {
    const gapState = getGapState(actor.group.position);
    return gapState.inPit || gapState.inShelter;
  }

  function updateActorVertical(actor, delta) {
    const groundY = getActorGroundY(actor);
    actor.verticalVelocity -= GRAVITY * delta;
    actor.group.position.y += actor.verticalVelocity * delta;

    if (actor.group.position.y <= groundY) {
      actor.group.position.y = groundY;
      actor.verticalVelocity = 0;
      actor.grounded = true;
      return;
    }

    actor.grounded = false;
  }

  function updateBot(bot, delta) {
    if (bot.stun > 0) {
      bot.stun -= delta;
      bot.velocity.multiplyScalar(0.8);
      return;
    }

    const steer = new THREE.Vector3();
    let target = null;
    const nearbyGap = SECTION_GAPS.find((gap) => Math.abs(bot.group.position.z - gap.center) < 12);
    if (nearbyGap) {
      target = new THREE.Vector3((bot.respawnX >= 0 ? 1 : -1) * SECTION_SIDE_X, 1.05, nearbyGap.center);
    } else if (bot.carrying || bot.carryingPet) {
      target = new THREE.Vector3(bot.group.position.x * 0.3, 1.05, 10);
    } else if (player.carrying && bot.group.position.distanceTo(player.group.position) < 13) {
      target = player.group.position;
    } else {
      if (!bot.targetLoot || !lootItems.includes(bot.targetLoot)) {
        bot.targetLoot = chooseLootTarget(bot);
      }
      const nearbyPet = petPickups
        .filter((pickup) => Math.abs(pickup.position.z - bot.group.position.z) < 85)
        .sort((a, b) => bot.group.position.distanceTo(a.position) - bot.group.position.distanceTo(b.position))[0];
      target = nearbyPet ? nearbyPet.position : bot.targetLoot ? bot.targetLoot.position : new THREE.Vector3(0, 0, WORLD.length * 0.65);
    }

    steer.copy(target).sub(bot.group.position).setY(0);
    if (steer.lengthSq() > 0.01) steer.normalize();

    for (const other of actors) {
      if (other === bot) continue;
      const away = bot.group.position.clone().sub(other.group.position).setY(0);
      const dist = away.length();
      if (dist > 0 && dist < 2.4) {
        steer.add(away.normalize().multiplyScalar((2.4 - dist) * 0.9));
      }
    }

    if (steer.lengthSq() > 0) steer.normalize();
    const speed = (9.6 + (bot.carrying || bot.carryingPet ? 0.7 : 0)) * getDisasterSpeedMultiplier();
    bot.velocity.addScaledVector(steer, speed * 7 * delta);
    bot.velocity.multiplyScalar(0.86);
    bot.group.position.addScaledVector(bot.velocity, delta);
  }

  function pickupLoot(actor) {
    if (actor.carrying || actor.carryingPet) return;
    for (let i = lootItems.length - 1; i >= 0; i--) {
      const loot = lootItems[i];
      if (actor.group.position.distanceTo(loot.position) < 1.85) {
        setCarry(actor, loot.userData.rarity);
        if (actor.isPlayer) {
          showToast(`Picked up ${loot.userData.rarity.key}. Bring it home to bank and display it.`);
        } else {
          actor.targetLoot = null;
        }
        scene.remove(loot);
        lootItems.splice(i, 1);
        return;
      }
    }
  }

  function pickupPet(actor) {
    if (actor.carrying || actor.carryingPet) return;
    for (let i = petPickups.length - 1; i >= 0; i--) {
      const pickup = petPickups[i];
      if (actor.group.position.distanceTo(pickup.position) < 2.05) {
        const { pet, section } = pickup.userData;
        if (actor.isPlayer) {
          claimPet(pet, section);
        } else {
          setActorCarryingPet(actor, { pet, section });
          actor.targetLoot = null;
        }
        scene.remove(pickup);
        petPickups.splice(i, 1);
        return;
      }
    }
  }

  function updateRunAnimation(actor, moving, delta) {
    actor.runCycle += delta * (moving ? 10.4 : 2.6);
    if (!actor.grounded) {
      actor.bones.leftArm.rotation.x = -0.5;
      actor.bones.rightArm.rotation.x = 0.4;
      actor.bones.leftArm.rotation.z = 0.14;
      actor.bones.rightArm.rotation.z = -0.14;
      actor.bones.leftLeg.rotation.x = -0.26;
      actor.bones.rightLeg.rotation.x = 0.48;
      actor.bones.leftLeg.rotation.z = 0;
      actor.bones.rightLeg.rotation.z = 0;
      actor.bones.leftArm.position.y = actor.bones.base.armY + 0.08;
      actor.bones.rightArm.position.y = actor.bones.base.armY + 0.08;
      actor.bones.leftLeg.position.y = actor.bones.base.legY;
      actor.bones.rightLeg.position.y = actor.bones.base.legY;
      actor.bones.body.position.y = actor.bones.base.bodyY + 0.06;
      actor.bones.head.position.y = actor.bones.base.headY + 0.04;
      actor.bones.head.rotation.x = -0.1;
      actor.bones.head.rotation.y = 0;
      actor.bones.body.rotation.x = -0.1;
      actor.bones.body.rotation.y = 0;
      actor.group.rotation.z = THREE.MathUtils.lerp(actor.group.rotation.z, 0, 0.2);
      return;
    }
    const swing = moving ? Math.sin(actor.runCycle) * 0.88 : 0;
    const counterSwing = moving ? Math.sin(actor.runCycle + Math.PI * 0.5) * 0.1 : 0;
    const bob = moving ? Math.abs(Math.sin(actor.runCycle * 0.5)) * 0.22 : 0;
    const lean = moving ? Math.sin(actor.runCycle * 0.5) * 0.06 : 0;
    actor.bones.leftArm.rotation.x = swing;
    actor.bones.rightArm.rotation.x = -swing;
    actor.bones.leftArm.rotation.z = 0.18 + lean;
    actor.bones.rightArm.rotation.z = -0.18 - lean;
    actor.bones.leftArm.position.y = actor.bones.base.armY + bob * 0.42;
    actor.bones.rightArm.position.y = actor.bones.base.armY + bob * 0.42;
    actor.bones.leftLeg.rotation.x = -swing * 0.82;
    actor.bones.rightLeg.rotation.x = swing * 0.82;
    actor.bones.leftLeg.rotation.z = -lean * 0.5;
    actor.bones.rightLeg.rotation.z = lean * 0.5;
    actor.bones.leftLeg.position.y = actor.bones.base.legY + counterSwing * 0.25;
    actor.bones.rightLeg.position.y = actor.bones.base.legY - counterSwing * 0.25;
    actor.bones.body.position.y = actor.bones.base.bodyY + bob;
    actor.bones.head.position.y = actor.bones.base.headY + bob * 0.82;
    actor.bones.head.rotation.x = moving ? -0.08 + Math.sin(actor.runCycle * 0.5) * 0.09 : -0.03;
    actor.bones.head.rotation.y = moving ? Math.sin(actor.runCycle * 0.25) * 0.04 : 0;
    actor.bones.body.rotation.x = moving ? -0.12 - bob * 0.24 : -0.04;
    actor.bones.body.rotation.y = moving ? lean * 0.45 : 0;
    actor.group.rotation.z = THREE.MathUtils.lerp(actor.group.rotation.z, moving ? Math.sin(actor.runCycle * 0.5) * 0.06 : 0, 0.16);
    if (actor.attackTimer > 0) {
      const slash = Math.sin((actor.attackTimer / 0.26) * Math.PI);
      actor.bones.rightArm.rotation.x = -1.35 + slash * 1.75;
      actor.bones.rightArm.rotation.y = -0.35 + slash * 0.55;
      actor.bones.rightArm.rotation.z = -0.72 - slash * 0.95;
      if (activeWeaponMesh && actor.isPlayer) {
        activeWeaponMesh.rotation.x = Math.PI / 2 - slash * 0.45;
        activeWeaponMesh.rotation.z = -slash * 0.8;
      }
    }
  }

  function lerpAngle(current, target, amount) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return current + delta * amount;
  }

  function clampActor(actor) {
    const inSpawnZone = actor.group.position.z < WORLD.spawnFrontZ;
    const maxX = inSpawnZone ? WORLD.spawnWidth / 2 - 2.5 : WORLD.laneWidth / 2 - 1.6;
    actor.group.position.x = THREE.MathUtils.clamp(actor.group.position.x, -maxX, maxX);
    actor.group.position.z = Math.max(WORLD.spawnBackZ + 3, actor.group.position.z);
  }

  function updatePlayer(delta) {
    if (player.stun > 0) {
      player.stun -= delta;
      player.velocity.multiplyScalar(0.75);
      player.group.position.addScaledVector(player.velocity, delta);
      clampActor(player);
      updateActorVertical(player, delta);
      updateRunAnimation(player, false, delta);
      return;
    }

    const forward = new THREE.Vector3(Math.sin(viewState.yaw), 0, Math.cos(viewState.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = new THREE.Vector3();
    if (input.forward) move.add(forward);
    if (input.back) move.sub(forward);
    if (input.right) move.add(right);
    if (input.left) move.sub(right);

    const moving = move.lengthSq() > 0;
    if (moving) move.normalize();

    if (justPressed.has('Jump') && player.grounded) {
      player.verticalVelocity = PLAYER_JUMP_SPEED;
      player.grounded = false;
    }

    const pet = getActivePet();
    const baseSpeed = 15.2 + gameState.speedLevel * 1.7 + pet.speedBonus;
    let accelScale = baseSpeed * 7.9 * getDisasterSpeedMultiplier();
    if (input.sprint && gameState.dashEnergy > 0 && moving) {
      accelScale *= 1.5;
      gameState.dashEnergy = Math.max(0, gameState.dashEnergy - delta);
    } else {
      gameState.dashEnergy = Math.min(gameState.dashMax, gameState.dashEnergy + delta * (0.52 + pet.dashRegenBonus));
    }

    player.velocity.addScaledVector(move, accelScale * delta);
    player.velocity.multiplyScalar(moving ? 0.86 : 0.74);
    player.group.position.addScaledVector(player.velocity, delta);
    clampActor(player);
    updateActorVertical(player, delta);

    const targetFacing = moving ? Math.atan2(move.x, move.z) : viewState.yaw;
    player.group.rotation.y = lerpAngle(player.group.rotation.y, targetFacing, moving ? 0.22 : 0.12);

    updateRunAnimation(player, moving, delta);
  }

  function updateRivals(delta) {
    for (const bot of bots) {
      updateBot(bot, delta);
      clampActor(bot);
      updateActorVertical(bot, delta);
      const horizontalVelocity = bot.velocity.clone().setY(0);
      if (horizontalVelocity.lengthSq() > 0.02) {
        bot.group.rotation.y = lerpAngle(bot.group.rotation.y, Math.atan2(horizontalVelocity.x, horizontalVelocity.z), 0.18);
      }
      updateRunAnimation(bot, horizontalVelocity.lengthSq() > 0.05, delta);
    }
  }

  function updateCollisions(delta) {
    for (const actor of actors) {
      pickupLoot(actor);
      pickupPet(actor);
      bankLoot(actor);
      bankCarriedPet(actor);
      actor.stealCooldown = Math.max(0, actor.stealCooldown - delta);
      actor.weaponCooldown = Math.max(0, actor.weaponCooldown - delta);
      actor.attackTimer = Math.max(0, actor.attackTimer - delta);
    }

    for (let i = 0; i < actors.length; i++) {
      for (let j = i + 1; j < actors.length; j++) {
        const a = actors[i];
        const b = actors[j];
        const dist = a.group.position.distanceTo(b.group.position);
        if (dist < 1.8) {
          const offset = a.group.position.clone().sub(b.group.position).setY(0);
          if (offset.lengthSq() > 0) {
            offset.normalize().multiplyScalar((1.8 - dist) * 0.35);
            a.group.position.add(offset);
            b.group.position.addScaledVector(offset, -1);
          }
          if (a.carrying && !b.carrying) stealLoot(b, a);
          if (b.carrying && !a.carrying) stealLoot(a, b);
        }
      }
    }
  }

  function updateLootVisuals() {
    for (const loot of lootItems) {
      loot.userData.spin += 0.02;
      loot.userData.bob += 0.045;
      loot.rotation.y = loot.userData.spin;
      loot.position.y = 0.2 + Math.sin(loot.userData.bob) * 0.14;
    }
    for (const pickup of petPickups) {
      pickup.userData.spin += 0.025;
      pickup.userData.bob += 0.05;
      pickup.rotation.y = pickup.userData.spin;
      pickup.position.y = 0.14 + Math.sin(pickup.userData.bob) * 0.22;
      pickup.userData.model.rotation.y += 0.022;
      pickup.userData.model.position.y = 0.78 + Math.abs(Math.sin(pickup.userData.bob * 0.75)) * 0.22;
      pickup.userData.model.scale.setScalar(1.12 + Math.sin(pickup.userData.bob * 0.5) * 0.04);
    }
    for (const item of displayItems) {
      if (item) item.rotation.y += 0.006;
    }
  }

  function updateWorld(delta) {
    ocean.position.z = player.group.position.z;
    const positions = ocean.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = Math.sin(clock.elapsedTime * 1.25 + x * 0.06) * 0.32 + Math.cos(clock.elapsedTime * 0.9 + positions.getY(i) * 0.03) * 0.16;
      positions.setZ(i, y);
    }
    positions.needsUpdate = true;
    ocean.geometry.computeVertexNormals();

    for (const cloud of clouds) {
      cloud.position.x += Math.sin(clock.elapsedTime * 0.18 + cloud.position.z * 0.01) * delta * 0.7;
    }

    for (const bobber of bobbers) {
      bobber.mesh.position.y = 2.35 + Math.sin(clock.elapsedTime * bobber.speed + bobber.offset) * bobber.amount;
      bobber.mesh.rotation.y += delta * 0.9;
      if (bobber.mesh.userData.isGodDeckSword) {
        bobber.mesh.rotation.z = Math.sin(clock.elapsedTime * 1.4 + bobber.offset) * 0.14;
        bobber.mesh.traverse((child) => {
          if (child.userData.spin) child.rotation.z += delta * child.userData.spin * 2.5;
          if (Number.isFinite(child.userData.orbit)) {
            child.position.x = Math.cos(clock.elapsedTime * 1.8 + child.userData.orbit) * 0.72;
            child.position.z = Math.sin(clock.elapsedTime * 1.8 + child.userData.orbit) * 0.18;
          }
        });
      }
    }
    animateCostumeAccessory(player.bones.costumeAccessory, clock.elapsedTime, delta);

    housePetDocks.forEach((dock, index) => {
      const preview = housePetDockStates[index].preview;
      if (!dock.group.visible || !preview) return;
      preview.position.y = Math.sin(clock.elapsedTime * 2.1 + index * 0.42) * 0.12;
      preview.rotation.y += delta * 0.72;
    });

    if (petStation.group.visible) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.6) * 0.08;
      petStation.upgradeButton.scale.setScalar(pulse);
      petStation.sellButton.scale.setScalar(1 + Math.cos(clock.elapsedTime * 2.6) * 0.08);
      if (petStationState.preview) {
        petStationState.preview.position.y = Math.sin(clock.elapsedTime * 2.2) * 0.16;
        petStationState.preview.rotation.y += delta * 0.8;
      }
    }

    if (activePetMesh) {
      petBob += delta * 4.5;
      const pet = getActivePet();
      const backDir = new THREE.Vector3(Math.sin(player.group.rotation.y), 0, Math.cos(player.group.rotation.y));
      const sideDir = new THREE.Vector3(backDir.z, 0, -backDir.x);
      const sideOffsetByPet = {
        frog: 0.9,
        deer: -1.1,
        cow: 1.15,
        tiger: -0.9,
        lion: 1.0,
        dragon: -1.35
      };
      const heightByPet = {
        frog: 0.48,
        deer: 0.82,
        cow: 0.7,
        tiger: 0.62,
        lion: 0.76,
        dragon: 1.08
      };
      const followDistance = pet.key === 'dragon' ? 2.3 : pet.key === 'deer' ? 2.0 : 1.75;
      const sideOffset = sideOffsetByPet[pet.key] ?? 0.75;
      const hover = heightByPet[pet.key] ?? 0.58;
      const followTarget = player.group.position.clone()
        .add(backDir.clone().multiplyScalar(-followDistance))
        .add(sideDir.multiplyScalar(sideOffset))
        .add(new THREE.Vector3(0, hover + Math.sin(petBob) * (pet.key === 'dragon' ? 0.32 : 0.22), 0));
      activePetMesh.position.lerp(followTarget, 0.14);
      activePetMesh.rotation.y = lerpAngle(activePetMesh.rotation.y, player.group.rotation.y + Math.sin(petBob * 0.5) * 0.08, 0.12);
      activePetMesh.rotation.z = THREE.MathUtils.lerp(activePetMesh.rotation.z, Math.sin(petBob) * (pet.key === 'dragon' ? 0.08 : 0.03), 0.1);
    }

    if (activeWeaponMesh?.userData.isGodDeckSword) {
      activeWeaponMesh.traverse((child) => {
        if (child.userData.spin) child.rotation.z += delta * child.userData.spin * 3.2;
        if (Number.isFinite(child.userData.orbit)) {
          child.position.x = Math.cos(clock.elapsedTime * 2.3 + child.userData.orbit) * 0.72;
          child.position.z = Math.sin(clock.elapsedTime * 2.3 + child.userData.orbit) * 0.18;
        }
      });
    }
    if (firstPersonWeaponMesh?.userData.isGodDeckSword) {
      firstPersonWeaponMesh.traverse((child) => {
        if (child.userData.spin) child.rotation.z += delta * child.userData.spin * 3.2;
        if (Number.isFinite(child.userData.orbit)) {
          child.position.x = Math.cos(clock.elapsedTime * 2.3 + child.userData.orbit) * 0.72;
          child.position.z = Math.sin(clock.elapsedTime * 2.3 + child.userData.orbit) * 0.18;
        }
      });
    }
    for (const actor of actors) {
      if (actor.petCarryMesh) {
        actor.petCarryMesh.position.y = 3.95 + Math.sin(clock.elapsedTime * 4.2 + actor.runCycle) * 0.12;
        actor.petCarryMesh.rotation.y += delta * 1.2;
      }
    }
  }

  function ecoLabel(kind) {
    if (kind === 'tree') return 'Tree';
    if (kind === 'flower') return 'Flower';
    if (kind === 'grass') return 'Grass';
    if (kind === 'glow') return 'Nature Point';
    return 'Nature';
  }

  function updateEnvironment(delta) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const entry of environmentInteractives) {
      const t = clock.elapsedTime + entry.offset;
      entry.cooldown = Math.max(0, entry.cooldown - delta);
      entry.pulse = Math.max(0, entry.pulse - delta * 1.75);
      entry.group.position.y = entry.baseY + Math.sin(t * 1.4) * 0.035;

      if (entry.kind === 'tree') {
        entry.group.rotation.z = Math.sin(t * 0.8) * 0.018 + Math.sin(entry.pulse * 22) * entry.pulse * 0.16;
        entry.group.rotation.x = Math.cos(entry.pulse * 18) * entry.pulse * 0.06;
      } else if (entry.kind === 'flower') {
        const bloom = 1 + Math.sin(t * 2.2) * 0.025 + entry.pulse * 0.28;
        entry.group.scale.setScalar(entry.baseScale * bloom);
        entry.group.rotation.y += delta * (0.25 + entry.pulse * 2.2);
      } else if (entry.kind === 'grass') {
        entry.group.rotation.z = Math.sin(t * 2.4) * 0.08 + Math.sin(entry.pulse * 16) * entry.pulse * 0.18;
        for (const blade of entry.group.children) {
          blade.rotation.x = Math.sin(t * 2.8 + blade.position.x) * 0.08;
        }
      } else if (entry.kind === 'glow') {
        entry.target.rotation.y += delta * (1.6 + entry.pulse * 7);
        entry.target.position.y = 1.65 + Math.sin(t * 3.2) * 0.18 + entry.pulse * 0.8;
        entry.target.scale.setScalar(1 + Math.sin(t * 2.8) * 0.08 + entry.pulse * 0.45);
      }

      const distance = entry.group.position.distanceTo(player.group.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = entry;
      }
    }

    if (nearest && nearestDistance < nearest.range + 2) {
      const screen = nearest.group.position.clone().setY(3.8).project(camera);
      ecoHint.style.display = 'block';
      ecoHint.style.left = `${(screen.x + 1) * 0.5 * window.innerWidth}px`;
      ecoHint.style.top = `${(-screen.y + 1) * 0.5 * window.innerHeight}px`;
      ecoHint.textContent = `Left click / E Interact ${ecoLabel(nearest.kind)}`;
    } else {
      ecoHint.style.display = 'none';
    }
  }

  function updateShops() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const shop of shops) {
      shop.ring.rotation.z += 0.025;
      const distance = shop.position.distanceTo(player.group.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = shop;
      }
    }

    if (nearest && nearestDistance < 4.6) {
      activeShopTarget = nearest;
      const screen = nearest.position.clone().setY(3.8).project(camera);
      shopHint.style.display = 'block';
      shopHint.style.left = `${(screen.x + 1) * 0.5 * window.innerWidth}px`;
      shopHint.style.top = `${(-screen.y + 1) * 0.5 * window.innerHeight}px`;
      const price = nearest.cost > 0 ? `${nearest.cost}` : 'Free';
      shopHint.textContent = `Left click ${nearest.actionLabel} ${nearest.label} (${price})`;
    } else {
      activeShopTarget = null;
      shopHint.style.display = 'none';
    }
  }

  function updateCamera(delta) {
    const planar = new THREE.Vector3(Math.sin(viewState.yaw), 0, Math.cos(viewState.yaw));
    const lookDir = new THREE.Vector3(
      Math.sin(viewState.yaw) * Math.cos(viewState.pitch),
      Math.sin(viewState.pitch),
      Math.cos(viewState.yaw) * Math.cos(viewState.pitch)
    );
    const headPos = player.group.position.clone().add(new THREE.Vector3(0, 3.1, 0));
    const mode = currentCameraMode().key;
    let desired = headPos.clone();
    let lookAt = headPos.clone().add(lookDir.clone().multiplyScalar(18));

    if (mode === 'third') {
      desired = headPos.clone()
        .add(planar.clone().multiplyScalar(-10.6))
        .add(new THREE.Vector3(0, 4.8 + viewState.pitch * 3.4, 0));
    } else if (mode === 'first') {
      desired = headPos.clone().add(lookDir.clone().multiplyScalar(0.15));
      lookAt = desired.clone().add(lookDir.clone().multiplyScalar(20));
    } else {
      desired = headPos.clone()
        .add(planar.clone().multiplyScalar(7.2))
        .add(new THREE.Vector3(0, 1.8 - viewState.pitch * 2.2, 0));
      lookAt = headPos.clone().add(new THREE.Vector3(0, 0.1, 0));
    }

    camera.position.lerp(desired, 1 - Math.pow(0.00035, delta));
    camera.lookAt(lookAt);
    housePetDocks.forEach((dock) => {
      if (dock.infoCard.visible) dock.infoCard.quaternion.copy(camera.quaternion);
    });
    if (petStation.infoCard.visible) {
      petStation.infoCard.quaternion.copy(camera.quaternion);
    }
    player.group.visible = mode !== 'first';
    if (activeWeaponMesh) activeWeaponMesh.visible = mode !== 'first';
    if (firstPersonWeaponMesh) {
      firstPersonWeaponMesh.visible = mode === 'first';
      if (mode === 'first') {
        const attackProgress = player.attackTimer > 0 ? 1 - player.attackTimer / 0.26 : 0;
        const slash = player.attackTimer > 0 ? Math.sin(attackProgress * Math.PI) : 0;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const weaponPos = camera.position.clone()
          .add(forward.clone().multiplyScalar(1.35 + slash * 0.18))
          .add(right.clone().multiplyScalar(0.46 - slash * 0.28))
          .add(up.clone().multiplyScalar(-0.42 + slash * 0.2));
        firstPersonWeaponMesh.position.copy(weaponPos);
        firstPersonWeaponMesh.quaternion.copy(camera.quaternion);
        firstPersonWeaponMesh.rotateX(0.2 - slash * 0.55);
        firstPersonWeaponMesh.rotateY(-0.22 + slash * 0.42);
        firstPersonWeaponMesh.rotateZ(-0.5 - slash * 1.2);
      }
    }
  }

  function updateBattlePanel(delta) {
    if (!isBattleOpen()) return;
    battleState.pollTimer += delta;
    if (battleState.pollTimer > 1.0) {
      battleState.pollTimer = 0;
      if (battleState.battleId) {
        pollBattle();
      } else {
        pollMatch();
      }
    }
    if (battleState.impactTimer > 0) {
      battleState.impactTimer -= delta;
      if (battleState.impactTimer <= 0) {
        document.querySelector('.player-fighter')?.classList.remove('attack', 'hurt');
        document.querySelector('.enemy-fighter')?.classList.remove('attack', 'hurt');
        ui.battleImpact.classList.remove('hit');
        if (activePetMesh) activePetMesh.scale.setScalar(1);
      }
    }
  }

  function updateHUD() {
    const currentSection = getSectionForZ(player.group.position.z);
    const currentTierLabel = currentSection ? nextTierLabel(currentSection) : 'Home Dock';
    const activePet = getActivePet();
    const petLevel = getPetLevel();
    ui.playerName.textContent = saveState.name;
    ui.bank.textContent = `${gameState.banked}`;
    ui.carry.textContent = player.carrying ? `${player.carrying.key} (+${player.carrying.value})` : 'None';
    ui.wave.textContent = gameState.calmOceanTimer > 0
      ? `Calm ${gameState.calmOceanTimer.toFixed(1)}s`
      : `${Math.max(0, gameState.nextWave).toFixed(1)}s`;
    ui.speed.textContent = ((15.2 + gameState.speedLevel * 1.7 + activePet.speedBonus) * getDisasterSpeedMultiplier()).toFixed(1);
    ui.dash.textContent = `${gameState.dashEnergy.toFixed(1)} / ${gameState.dashMax.toFixed(1)}`;
    ui.rivals.textContent = `${gameState.rivalBanked}`;
    ui.cameraMode.textContent = currentCameraMode().label;
    ui.collectionCount.textContent = `${saveState.collection.filter(Boolean).length} / ${SAVE_SLOT_COUNT}`;
    ui.totalAssets.textContent = `${getTotalAssets()}`;
    ui.objective.textContent = player.carrying
      ? 'Bring the idol back home. It will bank value, fill the next shelf, and your pet bonus will apply when it banks.'
      : activePet.key === 'none'
        ? saveState.placedPetKeys.some(Boolean)
          ? `You are in ${currentTierLabel}. Your five pet bases hold ${saveState.placedPetKeys.filter(Boolean).length} modeled pets. Aim at a base and press left click or E to pick one up.`
          : `You are in ${currentTierLabel}. Place modeled pets on the five pet bases, and sell old loot with the red buttons.`
        : `You are in ${currentTierLabel}. Disasters: ${getDisasterStatusLabel()}. Press B for Century Pet Battle.`;
  }

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    syncInfiniteBank();
    ensureSectionsAhead(player.group.position.z);
    updateWorld(delta);
    updatePlayer(delta);
    ensureSectionsAhead(player.group.position.z);
    updateRivals(delta);
    updateCollisions(delta);
    updateLootVisuals();
    cleanupDistantPickups();
    updateDisasters(delta);
    updateShops();
    updateCamera(delta);
    updateEnvironment(delta);
    updateBattlePanel(delta);
    if (justPressed.has('E')) {
      if (!handleWorldClick()) handleEnvironmentClick();
    }
    if (justPressed.has('F')) {
      buyShopUpgrade(activeShopTarget);
    }

    gameState.spawnTimer += delta;
    if (gameState.spawnTimer > 3.2) {
      spawnLoot();
      gameState.spawnTimer = 0;
    }

    gameState.petSpawnTimer += delta;
    if (gameState.petSpawnTimer > 1.6) {
      spawnPetPickup();
      gameState.petSpawnTimer = 0;
    }
    ensureCheatBossDragon();

    const activePet = getActivePet();
    if (activePet.key !== 'none') {
      gameState.petIncomeBuffer += delta * getPetIncomePerSecond();
      const minted = Math.floor(gameState.petIncomeBuffer);
      if (minted > 0) {
        gameState.banked += minted;
        gameState.petIncomeBuffer -= minted;
      }
    } else {
      gameState.petIncomeBuffer = 0;
    }

    gameState.autosaveTimer += delta;
    if (gameState.autosaveTimer > 10) {
      queueSave('Autosaved progress.');
      gameState.autosaveTimer = 0;
    }

    updateCalmOcean(delta);
    if (gameState.calmOceanTimer <= 0) {
      gameState.nextWave -= delta;
      if (gameState.nextWave <= 0) {
        createWave();
        gameState.nextWave = Math.max(9.2, 16 - gameState.waveCount * 0.3) + Math.random() * 2.2;
      }
    }
    updateWave(delta);

    if (gameState.toastTimer > 0) {
      gameState.toastTimer -= delta;
      if (gameState.toastTimer <= 0) {
        ui.toast.style.opacity = '0.35';
      }
    }

    updateHUD();
    justPressed.clear();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (saveState.name === 'Player') {
    showToast('Your permanent profile is ready. Give yourself a name on the right panel.');
  } else {
    showToast(`Welcome back, ${saveState.name}. Your house and upgrades were loaded.`);
  }

  updateHUD();
  requestAnimationFrame(animate);
})();
