// Test fixture (scripts/tests): a small two-storey house exercising the generic parts the sample
// house does not: a home lift (door facing north), a straight stair, gable / shed / flat roofs, a
// balcony, a basement-free northern-hemisphere site with the road on the east, a fence, a hedge.
export default {
  site: {
    w: 16, d: 20, road: 'e',
    perimeter: { front: 'fence', sides: 'hedge', back: 'wall', h: 1.6 },
    items: [
      { id: 'gate', kind: 'gate', from: [16, 3], to: [16, 7], type: 'sliding', auto: true },
      { id: 'drive', kind: 'driveway', r: [11, 3, 16, 7] },
      { id: 'yard', kind: 'paving', r: [11, 7, 14, 12] },
      { id: 'pond', kind: 'water', r: [2, 14, 5, 17] },
      { id: 'shed', kind: 'building', r: [12, 15, 15, 18], h: 2.6 },
      { id: 'court', kind: 'court', r: [5.5, 13.5, 10.5, 19.5] },
      { id: 'oak', kind: 'tree', c: [13, 13.5, 1], species: 'cypress' },
    ],
  },
  levels: [
    { id: 'G', name: 'Ground', elev: 0.15, h: 3.2 },
    { id: 'U', name: 'Upper', elev: 3.35, h: 3.0 },
  ],
  rooms: {
    G: [
      { id: 'hall', name: 'Hall', use: 'hall', r: [2, 2, 6, 6] },
      { id: 'room', name: 'Room', use: 'living', r: [6, 2, 11, 9] },
      { id: 'stairs', name: 'Stairs', use: 'stair', r: [2, 6, 6, 12] },
      { id: 'back', name: 'Back room', use: 'study', r: [6, 9, 11, 12] },
    ],
    U: [
      { id: 'landing', name: 'Landing', use: 'hall', r: [2, 2, 6, 12] },
      { id: 'bed', name: 'Bedroom', use: 'bedroom', r: [6, 2, 11, 9] },
    ],
  },
  open: { G: [['hall', 'stairs']], U: [] },
  openings: {
    G: [
      { o: 'v', x: 11, y: 4, w: 1.0, t: 'swing', side: -1, hinge: 's' },
      { o: 'v', x: 6, y: 4.4, w: 0.9, t: 'swing', side: 1, hinge: 's' },
      { o: 'h', x: 7, y: 9, w: 0.9, t: 'swing', side: 1, hinge: 'e' },
      { o: 'h', x: 7.5, y: 2, w: 2, t: 'window' },
    ],
    U: [
      { o: 'v', x: 6, y: 4.4, w: 0.9, t: 'swing', side: 1, hinge: 's' },
      { o: 'h', x: 7.5, y: 2, w: 2, t: 'window' },
      { o: 'h', x: 7, y: 9, w: 2.4, t: 'sliding', side: 1 },
    ],
  },
  // straight stair along the west wall climbing north, from the hall into the stair room
  stairs: [{ id: 's1', type: 'straight', r: [2.15, 4.0, 3.35, 9.7], up: 'n', from: 'G', to: 'U' }],
  // lift in the hall, door on its north face
  lift: { r: [4.4, 2.15, 5.925, 3.8], door: 'n', stops: ['G', 'U'] },
  outdoor: { U: [{ id: 'balc', kind: 'balcony', r: [6, 9, 11, 10.5] }] },
  roofs: [
    { id: 'main', type: 'gable', r: [2, 2, 11, 9], on: 'U', pitch: 0.5, over: 0.5, ridge: 'x' },
    { id: 'north', type: 'hip', r: [2, 9, 6, 12], on: 'U', pitch: 0.45, over: 0.4, pv: true },
    { id: 'back', type: 'shed', r: [6, 10.5, 11, 12], on: 'G', pitch: 0.15, over: 0.4, down: 'n' },
  ],
};
