// Plan data of the house: levels, rooms, doors & windows, stairs, roofs and the plot.
// The wizard (Claude Code) fills this in step by step. Field reference: docs/SCHEMA.md
// Units: metres. x → east, y → north, origin = south-west corner of the plot; the road is on side `site.road`.
// Room corners on a 0.5 m grid. Example of a complete house: projects/sample-house/zoning.js
export default {
  version: '0.1',

  site: {
    w: 15, d: 25, road: 's',
    perimeter: { front: 'wall', sides: 'wall', back: 'wall', h: 1.8, frontH: 1.2 },
    items: [
      { id: 'gate', kind: 'gate', name: { id: 'Gerbang', en: 'Gate' }, from: [9, 0], to: [13, 0], type: 'sliding', auto: true },
    ],
  },

  levels: [
    { id: 'L1', name: { id: 'Lantai 1', en: 'Ground floor' }, short: 'L1', elev: 0.15, h: 3.4 },
  ],

  // A first room so the 3D view has something to show; replace it with the real plan.
  rooms: {
    L1: [
      { id: 'living', name: { id: 'Ruang keluarga', en: 'Living room' }, use: 'living', r: [3, 6, 9, 12] },
    ],
  },

  open: {},

  openings: {
    L1: [
      { o: 'h', x: 5.5, y: 6, w: 1.0, t: 'swing', side: 1, hinge: 's' },   // front door
      { o: 'v', x: 9, y: 8, w: 1.5, t: 'window' },
    ],
  },

  stairs: [],

  roofs: [
    { id: 'main', type: 'hip', r: [3, 6, 9, 12], on: 'L1', pitch: 0.45, over: 0.8 },
  ],
};
