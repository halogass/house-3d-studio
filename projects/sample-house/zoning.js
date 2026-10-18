// Sample house — plan data (the "zoning"): levels, rooms, doors & windows, stairs, roofs and the plot.
// A simple two-storey tropical-modern family house, ±209 m² on a 19 × 30 m plot in Bandung.
// Ground floor: foyer, open living / dining / kitchen to the garden terrace, guest WC (with shower),
// laundry beside the carport, U-stair. Upper floor: master bedroom with ensuite and balcony,
// two bedrooms, family bathroom, small family lounge.
//
// Units: metres. Plan coordinates: x → east, y → north, origin = south-west corner of the plot.
// The road is on the south side (y = 0). Room corners are on a 0.5 m grid (walls are generated
// from the room rectangles: 30 cm exterior walls, 15 cm interior walls, centred on the room edges).
// Full field reference: docs/SCHEMA.md
export default {
  version: '1.0',

  site: {
    w: 19, d: 30, road: 's',
    // perimeter wall on all four sides (gaps where the gates are); frontH = lower wall on the road
    perimeter: { front: 'wall', sides: 'wall', back: 'wall', h: 1.8, frontH: 1.2 },
    items: [
      // ---- front (south): drive, carport, entrance path
      { id: 'gate', kind: 'gate', name: { id: 'Gerbang geser', en: 'Sliding gate' }, from: [13.5, 0], to: [18.5, 0], type: 'sliding', auto: true },
      { id: 'wicket', kind: 'gate', name: { id: 'Pintu pagar', en: 'Garden gate' }, from: [4.9, 0], to: [6.1, 0], type: 'swing' },
      { id: 'driveway', kind: 'driveway', name: { id: 'Jalan masuk', en: 'Driveway' }, r: [13.5, 0, 18.5, 1.5] },
      { id: 'carport', kind: 'carport', name: { id: 'Carport 2 mobil', en: 'Carport (2 cars)' }, r: [13, 1.5, 18.5, 8.5], h: 2.7, roof: 'flat' },
      { id: 'front_path', kind: 'path', name: { id: 'Jalan setapak', en: 'Front path' }, r: [4.9, 0, 6.1, 4.6], material: 'pavers' },
      { id: 'porch', kind: 'paving', name: { id: 'Teras depan', en: 'Front porch' }, r: [4, 4.6, 8, 6] },
      { id: 'front_lawn', kind: 'lawn', name: { id: 'Taman depan', en: 'Front garden' }, r: [0, 0, 13, 6] },
      { id: 'front_bed', kind: 'garden', name: { id: 'Bedeng tanaman', en: 'Planting bed' }, r: [0.4, 0.4, 4.2, 2.4] },
      { id: 'front_bed2', kind: 'garden', r: [8.6, 0.4, 12.6, 2.0] },
      { id: 'west_bed', kind: 'garden', r: [0.3, 6.5, 1.4, 15] },
      { id: 'frangipani', kind: 'tree', c: [10.5, 3.6, 0.9], species: 'olive' },
      // ---- back (north): terrace, pergola, pool, lawn, trees
      { id: 'terrace', kind: 'terrace', name: { id: 'Teras belakang', en: 'Garden terrace' }, r: [2, 15.5, 13, 18.5], material: 'teak' },
      { id: 'pergola', kind: 'pergola', name: { id: 'Pergola', en: 'Pergola' }, r: [7.5, 15.5, 13, 18.5] },
      { id: 'pool_deck', kind: 'paving', name: { id: 'Dek kolam', en: 'Pool deck' }, r: [6.5, 18.5, 16.5, 24.5] },
      { id: 'pool', kind: 'pool', name: { id: 'Kolam renang 6 × 3 m', en: 'Pool 6 × 3 m' }, r: [8, 20, 14, 23], depth: 1.3 },
      { id: 'back_lawn', kind: 'lawn', name: { id: 'Taman belakang', en: 'Back garden' }, r: [0, 18.5, 19, 30] },
      { id: 'back_trees', kind: 'trees', name: { id: 'Pohon peneduh', en: 'Shade trees' }, r: [0.5, 25.5, 18.5, 29.5], spacing: 4.5, species: 'shade' },
      { id: 'mango', kind: 'tree', name: { id: 'Pohon mangga', en: 'Mango tree' }, c: [16.5, 13.5, 1.1], species: 'fruit' },
      { id: 'east_hedge', kind: 'hedge', from: [18.4, 9.5], to: [18.4, 24.5] },
    ],
  },

  levels: [
    { id: 'L1', name: { id: 'Lantai 1', en: 'Ground floor' }, short: 'L1', elev: 0.15, h: 3.4 },
    { id: 'L2', name: { id: 'Lantai 2', en: 'Upper floor' }, short: 'L2', elev: 3.55, h: 3.2 },
  ],

  // Rooms per level. use: what the room is for (finishes, spec counts); zone: colour group in the plan.
  rooms: {
    L1: [
      { id: 'stair', name: { id: 'Tangga', en: 'Stair' }, use: 'stair', r: [2, 6, 4.5, 10] },
      { id: 'foyer', name: { id: 'Foyer', en: 'Foyer' }, use: 'foyer', r: [4.5, 6, 7.5, 10], note: { id: 'Pintu utama ganda, bangku & rak sepatu.', en: 'Double front door, bench and shoe cabinet.' } },
      { id: 'wc', name: { id: 'Toilet tamu + shower', en: 'Guest WC + shower' }, short: 'WC', use: 'wc', r: [7.5, 6, 9, 10] },
      { id: 'laundry', name: { id: 'Laundry', en: 'Laundry' }, use: 'laundry', r: [9, 6, 13, 9], note: { id: 'Pintu samping ke carport.', en: 'Side door to the carport.' } },
      { id: 'kitchen', name: { id: 'Dapur', en: 'Kitchen' }, use: 'kitchen', r: [9, 9, 13, 12] },
      { id: 'dining', name: { id: 'Ruang makan', en: 'Dining' }, use: 'dining', r: [9, 12, 13, 15.5] },
      { id: 'living', name: { id: 'Ruang keluarga', en: 'Living room' }, use: 'living', r: [2, 10, 9, 15.5], note: { id: 'Pintu kaca geser ke teras & taman.', en: 'Glass sliding door to the terrace and garden.' } },
    ],
    L2: [
      { id: 'stairhall', name: { id: 'Hall tangga', en: 'Stair hall' }, short: 'Hall', use: 'hall', r: [2, 6, 4.5, 11.5] },
      { id: 'corridor', name: { id: 'Koridor', en: 'Corridor' }, use: 'hall', r: [4.5, 10, 13, 11.5] },
      { id: 'bed2', name: { id: 'Kamar tidur 2', en: 'Bedroom 2' }, short: { id: 'Kamar 2', en: 'Bed 2' }, use: 'bedroom', r: [4.5, 6, 8, 10] },
      { id: 'bath', name: { id: 'Kamar mandi', en: 'Family bathroom' }, short: { id: 'KM', en: 'Bath' }, use: 'bath', r: [8, 6, 10, 10] },
      { id: 'bed3', name: { id: 'Kamar tidur 3', en: 'Bedroom 3' }, short: { id: 'Kamar 3', en: 'Bed 3' }, use: 'bedroom', r: [10, 6, 13, 10] },
      { id: 'master', name: { id: 'Kamar utama', en: 'Master bedroom' }, use: 'master', r: [2, 11.5, 8, 15.5], note: { id: 'Pintu kaca ke balkon menghadap taman.', en: 'Glass door to the balcony over the garden.' } },
      { id: 'ensuite', name: { id: 'KM kamar utama', en: 'Ensuite' }, short: { id: 'KM', en: 'Ensuite' }, use: 'bath', zone: 'master', r: [8, 11.5, 10.5, 15.5] },
      { id: 'lounge', name: { id: 'Ruang santai', en: 'Family lounge' }, short: { id: 'Santai', en: 'Lounge' }, use: 'family', r: [10.5, 11.5, 13, 15.5] },
    ],
  },

  // Room pairs with no wall between them (open plan)
  open: {
    L1: [['living', 'dining'], ['living', 'kitchen'], ['kitchen', 'dining'], ['stair', 'living']],
    L2: [['stairhall', 'corridor'], ['corridor', 'lounge']],
  },

  // Doors & windows. o: 'h' = on a horizontal wall (runs along x, at y), spans x … x + w;
  // 'v' = on a vertical wall (runs along y, at x), spans y … y + w.
  // side: +1 the leaf opens towards +y ('h') / +x ('v'), −1 the other way. hinge: 's' at the start end, 'e' at the far end.
  openings: {
    L1: [
      { o: 'h', x: 5.4, y: 6, w: 1.2, t: 'double', side: 1 },                 // front door
      { o: 'h', x: 6.75, y: 6, w: 0.45, t: 'glass' },                         // side light
      { o: 'h', x: 5.2, y: 10, w: 1.8, t: 'opening' },                        // foyer → living
      { o: 'v', x: 7.5, y: 8.0, w: 0.8, t: 'swing', side: 1, hinge: 'e' },    // guest WC
      { o: 'h', x: 7.9, y: 6, w: 0.7, t: 'high' },
      { o: 'h', x: 11.2, y: 9, w: 0.8, t: 'swing', side: -1, hinge: 'e' },    // kitchen → laundry
      { o: 'v', x: 13, y: 7.2, w: 0.9, t: 'swing', side: -1, hinge: 's' },    // laundry → carport
      { o: 'h', x: 9.6, y: 6, w: 1.2, t: 'window' },
      { o: 'v', x: 13, y: 9.6, w: 1.2, t: 'window' },                         // kitchen, over the sink
      { o: 'v', x: 13, y: 13.2, w: 1.5, t: 'window' },                        // dining
      { o: 'h', x: 9.6, y: 15.5, w: 2.8, t: 'folding', side: 1 },             // dining → pergola
      { o: 'h', x: 3.0, y: 15.5, w: 3.6, t: 'sliding', side: 1 },             // living → terrace
      { o: 'h', x: 7.0, y: 15.5, w: 1.4, t: 'window' },
      { o: 'v', x: 2, y: 10.5, w: 1.8, t: 'window' },                         // living, west
      { o: 'v', x: 2, y: 7.4, w: 1.2, t: 'high' },                            // stair landing
    ],
    L2: [
      { o: 'h', x: 6.6, y: 10, w: 0.9, t: 'swing', side: -1, hinge: 'e' },    // bedroom 2
      { o: 'h', x: 8.6, y: 10, w: 0.8, t: 'swing', side: -1, hinge: 's' },    // bathroom
      { o: 'h', x: 10.5, y: 10, w: 0.9, t: 'swing', side: -1, hinge: 's' },   // bedroom 3
      { o: 'h', x: 5.2, y: 11.5, w: 0.9, t: 'swing', side: 1, hinge: 's' },   // master
      { o: 'v', x: 8, y: 12.0, w: 0.8, t: 'swing', side: 1, hinge: 's' },     // ensuite
      { o: 'h', x: 5.5, y: 6, w: 1.6, t: 'window' },
      { o: 'h', x: 8.6, y: 6, w: 0.8, t: 'high' },
      { o: 'h', x: 10.7, y: 6, w: 1.6, t: 'window' },
      { o: 'v', x: 13, y: 7.2, w: 1.4, t: 'window' },
      { o: 'h', x: 2.8, y: 15.5, w: 2.4, t: 'sliding', side: 1 },             // master → balcony
      { o: 'h', x: 5.8, y: 15.5, w: 1.4, t: 'window' },
      { o: 'v', x: 2, y: 12.6, w: 1.6, t: 'window' },
      { o: 'h', x: 8.6, y: 15.5, w: 1.2, t: 'high' },
      { o: 'h', x: 11, y: 15.5, w: 1.5, t: 'window' },
      { o: 'v', x: 13, y: 12.5, w: 1.6, t: 'window' },
      { o: 'v', x: 2, y: 7.2, w: 1.2, t: 'window' },                          // stair hall
    ],
  },

  // U-stair in the stair room: the first flight climbs south on the west half to a landing under
  // the window, the second climbs back north on the east half and arrives in the upper hall.
  stairs: [
    { id: 'main', type: 'U', r: [2.15, 6.15, 4.425, 9.95], up: 's', first: 'right', from: 'L1', to: 'L2' },
  ],

  // Upper-floor balcony over the living-room terrace
  outdoor: {
    L2: [
      { id: 'balcony', kind: 'balcony', name: { id: 'Balkon', en: 'Balcony' }, r: [2, 15.5, 6, 17] },
    ],
  },

  // Roofs: r = the area under the roof (without the overhang); on = the level whose wall tops carry the eaves
  roofs: [
    { id: 'main', type: 'hip', r: [2, 6, 13, 15.5], on: 'L2', pitch: 0.45, over: 0.9, pv: true },
    { id: 'canopy', type: 'flat', r: [4, 4.6, 8, 6], base: 3.0, over: { w: 0.1, s: 0.1, e: 0.1, n: 0 }, parapet: 0 },
  ],
};
