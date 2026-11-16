// SALTDOWN — map data for "Saltline", an original container-terminal map.
// Pure data: axis-aligned boxes (x,z = center, w,d = footprint, h = height, y = base),
// material keys from config.PALETTE, plant sites, spawns and a waypoint graph the bots walk.

// Materials: g ground (implicit), c concrete, d dark concrete, m metal, r rust, t teal accent, o orange accent.
export const BOXES = [
  // outer walls
  { x: 0, z: -46, w: 92, d: 2, h: 6, m: 'c' },
  { x: 0, z: 46, w: 92, d: 2, h: 6, m: 'c' },
  { x: -45, z: 0, w: 2, d: 94, h: 6, m: 'c' },
  { x: 45, z: 0, w: 2, d: 94, h: 6, m: 'c' },

  // central "crane alley" mid lane — long sightline with cover crates
  { x: -3, z: -18, w: 6, d: 6, h: 2.6, m: 'r' },
  { x: 3, z: -6, w: 6, d: 6, h: 2.6, m: 'r' },
  { x: -3, z: 6, w: 6, d: 6, h: 2.6, m: 'r' },
  { x: 3, z: 18, w: 6, d: 6, h: 2.6, m: 'r' },
  { x: 0, z: 0, w: 2.2, d: 2.2, h: 7.5, m: 'm' }, // crane pillar

  // site A (west, attackers push via upper catwalk or low hall)
  { x: -30, z: -28, w: 18, d: 16, h: 0.5, m: 'd' }, // raised platform (walkable ramp height)
  { x: -30, z: -28, w: 4, d: 4, h: 3.4, m: 't' }, // plant prop
  { x: -38, z: -20, w: 6, d: 4, h: 2.6, m: 'r' },
  { x: -24, z: -34, w: 8, d: 3, h: 2.6, m: 'r' },
  { x: -22, z: -22, w: 3, d: 3, h: 2.2, m: 'm' },
  { x: -36, z: -36, w: 4, d: 2, h: 3.6, m: 'm' }, // cover pillar

  // site B (east, reached through container maze)
  { x: 30, z: 28, w: 18, d: 16, h: 0.5, m: 'd' },
  { x: 30, z: 28, w: 4, d: 4, h: 3.4, m: 'o' }, // plant prop
  { x: 22, z: 20, w: 5, d: 5, h: 2.6, m: 'r' },
  { x: 37, z: 33, w: 5, d: 3, h: 2.6, m: 'r' },
  { x: 24, z: 33, w: 3, d: 3, h: 2.2, m: 'm' },
  { x: 36, z: 22, w: 2, d: 2, h: 3.6, m: 'm' },

  // container maze between mid and B
  { x: 16, z: 6, w: 6, d: 14, h: 2.6, m: 'r' },
  { x: 24, z: -2, w: 8, d: 6, h: 2.6, m: 'm' },
  { x: 30, z: 8, w: 6, d: 10, h: 2.6, m: 'r' },
  { x: 16, z: 20, w: 10, d: 5, h: 2.6, m: 'o' },
  { x: 34, z: 14, w: 4, d: 4, h: 2.2, m: 'm' },

  // west flank to A (long hall with window)
  { x: -24, z: 4, w: 10, d: 6, h: 3.2, m: 'm' },
  { x: -32, z: 14, w: 6, d: 8, h: 2.6, m: 'r' },
  { x: -14, z: 16, w: 5, d: 5, h: 2.6, m: 'r' },
  { x: -30, z: 28, w: 12, d: 5, h: 2.6, m: 'o' },

  // attacker spawn (south) and defender spawn (north) cover
  { x: -12, z: 38, w: 6, d: 5, h: 2.6, m: 'r' },
  { x: 12, z: -38, w: 6, d: 5, h: 2.6, m: 'r' },
  { x: 0, z: 34, w: 8, d: 3, h: 1.1, m: 'm' }, // ramp-ish low block at T spawn exit
  { x: 0, z: -34, w: 8, d: 3, h: 1.1, m: 'm' },
  { x: -20, z: -44, w: 6, d: 4, h: 2.6, m: 'm' },
  { x: 20, z: 44, w: 6, d: 4, h: 2.6, m: 'm' },
];

// Raised platforms are walkable (h 1.2). Plant zones: an attacker standing inside with the
// charge may plant. Defender defuse needs the charge planted here.
export const SITES = [
  { name: 'A', x: -30, z: -28, radius: 7 },
  { name: 'B', x: 30, z: 28, radius: 7 },
];

export const SPAWNS = {
  attack: [ // south
    { x: -6, z: 41 }, { x: -2, z: 42 }, { x: 2, z: 41 }, { x: 6, z: 42 }, { x: 0, z: 39 },
  ],
  defend: [ // north
    { x: -6, z: -41 }, { x: -2, z: -42 }, { x: 2, z: -41 }, { x: 6, z: -42 }, { x: 0, z: -39 },
  ],
};

// Waypoint graph. Bots pathfind over edges and steer node to node.
export const WAYPOINTS = [
  { x: 0, z: 38 },      // 0 attack spawn hub
  { x: 0, z: 26 },      // 1 mid south entrance
  { x: 0, z: 12 },      // 2 mid center south
  { x: 0, z: -12 },     // 3 mid center north
  { x: 0, z: -26 },     // 4 mid north entrance
  { x: 0, z: -38 },     // 5 defend spawn hub
  { x: -18, z: 30 },    // 6 west route low
  { x: -26, z: 18 },    // 7 west hall
  { x: -34, z: 6 },     // 8 west hall north
  { x: -30, z: -12 },   // 9 approach A from west
  { x: -30, z: -24 },   // 10 site A
  { x: -18, z: -34 },   // 11 A north connector
  { x: -12, z: -20 },   // 12 A to mid link
  { x: 16, z: 30 },     // 13 east route
  { x: 26, z: 18 },     // 14 maze south
  { x: 26, z: 4 },      // 15 maze center
  { x: 20, z: -8 },     // 16 maze north
  { x: 24, z: -22 },    // 17 east link north
  { x: 30, z: -30 },    // 18 B north approach (rotator)
  { x: 30, z: 24 },     // 19 site B
  { x: 14, z: 38 },     // 20 B south connector
  { x: -12, z: 8 },     // 21 mid-west link
  { x: 12, z: -8 },     // 22 mid-east link
];

export const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [0, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 2], [12, 3], [9, 12],
  [0, 20], [20, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 14], [19, 15], [18, 4], [17, 3],
  [1, 21], [21, 7], [2, 21], [5, 18], [3, 22], [22, 16], [4, 22], [13, 19],
];

// Per-role default target site preference (index into SITES), split across the team.
export const TEAM_PLAN = {
  attack: [0, 0, 1, 1],   // 2 push A, 2 push B (player free)
  defend: [0, 0, 1, 1],   // 2 hold each site
};
