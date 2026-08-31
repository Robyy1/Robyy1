window.DATA = (() => {
  const C = {
    cyan: "#8fdcff",
    cyanBright: "#e6faff",
    gold: "#ffd166",
    red: "#ff5b6e",
    orange: "#ffb347",
    magenta: "#ff6bff",
    bg: "#04050e",
  };

  const SHIPS = [
    { id: 0, name: "Scout", color: "#8fdcff", accent: "#e6faff", maxHp: 3, speed: 5.2, fireMult: 1.0, slots: 2, keyCost: 0 },
    { id: 1, name: "Interceptor", color: "#7fffb0", accent: "#d6ffe8", maxHp: 2, speed: 6.8, fireMult: 1.05, slots: 2, keyCost: 2 },
    { id: 2, name: "Guardian", color: "#ffb347", accent: "#fff0d6", maxHp: 6, speed: 4.0, fireMult: 0.9, slots: 2, keyCost: 4 },
    { id: 3, name: "Ranger", color: "#b58cff", accent: "#efe6ff", maxHp: 4, speed: 5.6, fireMult: 1.2, slots: 2, keyCost: 7 },
    { id: 4, name: "Titan", color: "#ff6bff", accent: "#ffe6ff", maxHp: 8, speed: 4.6, fireMult: 1.1, slots: 2, keyCost: 10 },
  ];

  const GUNS = [
    { id: 0, name: "Blaster", color: "#7fd1ff", dmg: 1, speed: 9.5, spread: [0], size: [4, 14], homing: false, penetrate: false, keyCost: 0, creditCost: 0 },
    { id: 1, name: "Spread Shot", color: "#9fe8ff", dmg: 1, speed: 8.2, spread: [-0.24, 0, 0.24], size: [4, 13], homing: false, penetrate: false, keyCost: 3, creditCost: 60 },
    { id: 2, name: "Dual Beam", color: "#7fffb0", dmg: 1, speed: 13.5, spread: [0, 0], offset: [-8, 8], size: [3, 18], homing: false, penetrate: false, keyCost: 5, creditCost: 120 },
    { id: 3, name: "Missile Bay", color: "#ffb347", dmg: 3, speed: 5.6, spread: [0], size: [9, 12], homing: true, penetrate: false, keyCost: 8, creditCost: 220 },
    { id: 4, name: "Ion Cannon", color: "#ff6bff", dmg: 5, speed: 15.5, spread: [0], size: [6, 26], homing: false, penetrate: true, keyCost: 11, creditCost: 340 },
  ];

  const CONSUMABLES = [
    { id: 0, name: "Shield Cell", color: "#7fd1ff", desc: "Grants a temporary shield that destroys incoming bullets.", charges: 3, keyCost: 0, creditCost: 0 },
    { id: 1, name: "Repair Kit", color: "#7fffb0", desc: "Instantly restores 3 ship HP.", charges: 3, keyCost: 2, creditCost: 80 },
    { id: 2, name: "Thrusters", color: "#ffb347", desc: "Boosts movement speed for 8 seconds.", charges: 2, keyCost: 4, creditCost: 120 },
    { id: 3, name: "Ion Bomb", color: "#ff6bff", desc: "Clears all bullets and damages nearby enemies.", charges: 2, keyCost: 6, creditCost: 180 },
    { id: 4, name: "Overdrive", color: "#ffd166", desc: "Rapid-fire for 8 seconds.", charges: 2, keyCost: 9, creditCost: 260 },
  ];

  const ENEMY_TYPES = {
    drone: { name: "Drone", hp: 1, speed: 1.3, w: 26, h: 22, color: "#ff6b6b", accent: "#ffd166", credits: 1, shoot: false, sineAmp: 0 },
    zigzag: { name: "Zigzag", hp: 1, speed: 1.7, w: 24, h: 20, color: "#ff9a4d", accent: "#fff0d6", credits: 2, shoot: false, sineAmp: 38, sineFreq: 0.05 },
    speeder: { name: "Speeder", hp: 1, speed: 3.2, w: 22, h: 20, color: "#ff5b6e", accent: "#ffe6ff", credits: 2, shoot: false, sineAmp: 0 },
    tank: { name: "Tank", hp: 6, speed: 0.8, w: 34, h: 30, color: "#b58cff", accent: "#fff0d6", credits: 6, shoot: false, sineAmp: 0 },
    shooter: { name: "Shooter", hp: 2, speed: 1.1, w: 28, h: 24, color: "#7fffb0", accent: "#e6faff", credits: 4, shoot: true, fireRate: 90, sineAmp: 18, sineFreq: 0.03 },
    splitter: { name: "Splitter", hp: 3, speed: 1.4, w: 30, h: 26, color: "#ffd166", accent: "#ff6bff", credits: 5, shoot: false, sineAmp: 28, sineFreq: 0.04 },
  };

  const BOSS_TYPES = {
    laser: {
      name: "Sentinel", color: "#7fd1ff", accent: "#e6faff", hp: 90, w: 90, h: 60, credits: 250, keys: 3,
      patterns: ["burst", "sweep"],
    },
    brute: {
      name: "Juggernaut", color: "#ffb347", accent: "#fff0d6", hp: 140, w: 100, h: 70, credits: 350, keys: 4,
      patterns: ["punchL", "punchR", "slam"],
    },
    missile: {
      name: "Havoc", color: "#ff6bff", accent: "#ffe6ff", hp: 120, w: 92, h: 64, credits: 300, keys: 4,
      patterns: ["homingSwarm", "barrage"],
    },
    minigunner: {
      name: "Vulcan", color: "#7fffb0", accent: "#e6faff", hp: 110, w: 96, h: 62, credits: 320, keys: 5,
      patterns: ["stream", "heatBurst"],
    },
  };

  const BOSS_ORDER = ["laser", "brute", "missile", "minigunner"];

  return { C, SHIPS, GUNS, CONSUMABLES, ENEMY_TYPES, BOSS_TYPES, BOSS_ORDER };
})();
