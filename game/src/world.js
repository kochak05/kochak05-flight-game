// world.js — the island strait: seeded terrain, islands, runway, rings, legs.
// One job: describe the world and answer heightAt(x, y). Nothing else draws or moves.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The strait runs north (+y) from y = 0 to y = 12000, about 4400 m wide.
export const STRAIT = { minX: -2200, maxX: 2200, minY: -300, maxY: 12400 };
export const RUNWAY = {
  x: 0,
  y: 10800,
  length: 700,
  width: 46,
  heading: 0, // north, along +y
  name: 'STRAIT FIELD 36',
};

// One island: a lumpy disc with a beach, grass and a mountain peak.
function makeIsland(random, cx, cy, radius, peak) {
  const points = 10;
  const radii = [];
  for (let i = 0; i < points; i++) {
    radii.push(radius * (0.78 + random() * 0.45));
  }
  return { cx, cy, radius, peak, points, radii };
}

function islandRadiusAt(island, angle) {
  const step = (Math.PI * 2) / island.points;
  const i = Math.floor(angle / step) % island.points;
  const j = (i + 1) % island.points;
  const f = angle / step - Math.floor(angle / step);
  const r = island.radii[i] + (island.radii[j] - island.radii[i]) * f;
  return r;
}

export function buildWorld(seed = 20261126) {
  const random = mulberry32(seed);

  // Islands flanking and dotting the strait. The runway island is big and flat.
  const islands = [
    makeIsland(random, 0, 10800, 900, 14), // runway island (flat)
    makeIsland(random, -1500, 1500, 620, 210),
    makeIsland(random, 1350, 2300, 480, 160),
    makeIsland(random, -1200, 3600, 420, 320),
    makeIsland(random, 1500, 4400, 560, 240),
    makeIsland(random, -1600, 5600, 500, 180),
    makeIsland(random, 1200, 6400, 380, 290),
    makeIsland(random, -1350, 7600, 470, 150),
    makeIsland(random, 1450, 8300, 520, 260),
    makeIsland(random, -1500, 9400, 430, 120),
    makeIsland(random, 1150, 9900, 360, 200),
    makeIsland(random, -900, 2100, 240, 90),
    makeIsland(random, 800, 5100, 220, 110),
    makeIsland(random, -700, 7000, 200, 70),
    makeIsland(random, 650, 8800, 230, 95),
  ];

  // Waves: short strokes scattered over the sea, drawn only when in view.
  const waves = [];
  for (let i = 0; i < 520; i++) {
    waves.push({
      x: STRAIT.minX + random() * (STRAIT.maxX - STRAIT.minX),
      y: STRAIT.minY + random() * (STRAIT.maxY - STRAIT.minY),
      len: 18 + random() * 42,
      angle: random() * Math.PI,
      alpha: 0.05 + random() * 0.1,
    });
  }

  // Clouds drift slowly above the terrain.
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: STRAIT.minX + random() * (STRAIT.maxX - STRAIT.minX),
      y: STRAIT.minY + random() * (STRAIT.maxY - STRAIT.minY),
      size: 120 + random() * 260,
      speed: 6 + random() * 10,
      puffs: 4 + Math.floor(random() * 3),
    });
  }

  return { islands, waves, clouds, seed };
}

// Terrain height in metres at a world point. Sea is 0.
export function heightAt(world, x, y) {
  // The runway strip is flattened so landings are fair.
  const rw = RUNWAY;
  const localX = x - rw.x;
  const localY = y - rw.y;
  if (Math.abs(localX) < rw.width / 2 + 60 && Math.abs(localY) < rw.length / 2 + 60) {
    return 2;
  }
  let height = 0;
  for (const island of world.islands) {
    const dx = x - island.cx;
    const dy = y - island.cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= island.radius * 1.25) continue;
    const angle = Math.atan2(dy, dx) + Math.PI;
    const edge = islandRadiusAt(island, angle);
    if (dist >= edge) continue;
    const fall = 1 - dist / edge;
    const h = island.peak * Math.pow(fall, 1.6);
    if (h > height) height = h;
  }
  return height;
}

export function terrainAt(world, x, y) {
  const h = heightAt(world, x, y);
  if (h > 140) return 'mountain';
  if (h > 18) return 'hill';
  if (h > 2) return 'land';
  return 'sea';
}

// One leg: its rings, start state and time limit (0 = no limit).
export const LEGS = [
  {
    name: 'LEG 1 — RING RUN',
    brief: 'Fly the strait, thread all 5 gold rings, then land on the runway.',
    timeLimit: 0,
    start: { x: 0, y: 300, heading: 0, altitude: 120, speed: 70, fuel: 100 },
    rings: [
      { x: -350, y: 2000, alt: 150 },
      { x: 420, y: 4000, alt: 220 },
      { x: -300, y: 6000, alt: 180 },
      { x: 380, y: 8000, alt: 300 },
      { x: 0, y: 9500, alt: 250 },
    ],
  },
  {
    name: 'LEG 2 — PRECISION LANDING',
    brief: 'Two rings, then a precision touchdown: centreline, slow, gentle.',
    timeLimit: 0,
    start: { x: 0, y: 300, heading: 0, altitude: 120, speed: 70, fuel: 100 },
    rings: [
      { x: 300, y: 5500, alt: 200 },
      { x: -260, y: 8800, alt: 220 },
    ],
    precision: true,
  },
  {
    name: 'LEG 3 — TIMED RUN',
    brief: 'Five rings and a landing before the clock runs out. 150 seconds.',
    timeLimit: 150,
    start: { x: 0, y: 300, heading: 0, altitude: 120, speed: 70, fuel: 100 },
    rings: [
      { x: -420, y: 2200, alt: 180 },
      { x: 460, y: 4300, alt: 260 },
      { x: -380, y: 6300, alt: 200 },
      { x: 400, y: 8200, alt: 320 },
      { x: 0, y: 9600, alt: 240 },
    ],
  },
];
