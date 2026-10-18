// Sample house — interior: finishes and furniture per room, plus furniture outside the rooms
// ('areas', keyed by a site item id). Furniture types and their sizes: docs/SCHEMA.md.
//
// Item: { type, x, y, rot, ...params }
//   x, y  plan position (m) of the item's footprint centre; wall items: the point on the inner wall face
//   rot   the direction the item's FRONT faces: 0 = north, 90 = east, 180 = south, 270 = west
//   z     wall items: centre height on the wall; lamps on a table: the table top height
// Walls are 15 cm (interior) / 30 cm (exterior) thick and centred on the room edges, so the inner
// wall face is 0.075 m (interior wall) or 0.15 m (exterior wall) inside the room rectangle.
// `npm run check-interior` checks that nothing overlaps, blocks a door or stands in front of a window.
export default {
  version: '1.0',
  rooms: {
    // ------------------------------------------------------------ ground floor
    stair: {
      finish: { walls: 'paint', wallColor: '#ece7de', floor: 'travertine' },
      items: [],
    },
    foyer: {
      finish: { walls: 'paint', wallColor: '#e9e3d8', floor: 'travertine' },
      items: [
        { type: 'consoleTable', x: 4.75, y: 8.0, rot: 90, w: 1.2, d: 0.35, mat: 'oak' },
        { type: 'mirror', x: 4.575, y: 8.0, rot: 90, z: 1.55 },
        { type: 'outdoorBench', x: 7.22, y: 7.35, rot: 270, w: 1.2, d: 0.4 },
        { type: 'plantPot', x: 7.15, y: 6.45, size: 'medium' },
        { type: 'rug', x: 6.0, y: 7.6, w: 1.6, d: 1.0, mat: 'rugJute' },
        { type: 'pendantDome', x: 6.0, y: 8.0 },
      ],
    },
    wc: {
      finish: { walls: 'tile', floor: 'tileBath' },
      items: [
        { type: 'toilet', x: 8.25, y: 6.49, rot: 0 },
        { type: 'vanity', x: 8.715, y: 8.4, rot: 270, w: 0.6, d: 0.42, sinks: 1 },
        { type: 'showerGlass', x: 8.25, y: 9.475, rot: 180, w: 1.2, d: 0.9, sides: ['front'] },
        { type: 'towelRail', x: 7.575, y: 7.0, rot: 90 },
      ],
    },
    laundry: {
      finish: { walls: 'paint', wallColor: '#ecebe6', floor: 'tileGrey' },
      items: [
        { type: 'kitchenRun', x: 9.375, y: 7.4, rot: 90, w: 1.4, d: 0.6, sink: true, cabinet: 'cabinetCream', top: 'graniteBlack' },
        { type: 'washer', x: 11.2, y: 6.45, rot: 0 },
        { type: 'dryer', x: 11.85, y: 6.45, rot: 0 },
        { type: 'shelvingUnit', x: 12.625, y: 6.7, rot: 270, w: 1.0, d: 0.45 },
        { type: 'panelLed', x: 11.0, y: 7.6 },
      ],
    },
    kitchen: {
      finish: { walls: 'paint', wallColor: '#eeeae2', floor: 'travertine' },
      items: [
        // sink under the window, cooktop beside it, fridge column at the north end
        { type: 'kitchenRun', x: 12.54, y: 10.5, rot: 270, w: 2.8, d: 0.62, sink: 0.55, cooktop: -0.24, tall: 'fridge', tallSide: 'left', cabinet: 'lacquer:#4d5b4a', top: 'marbleWhite' },
        { type: 'kitchenIsland', x: 10.55, y: 11.0, rot: 90, w: 1.6, d: 0.9, cabinet: 'lacquer:#4d5b4a', top: 'marbleWhite' },
        { type: 'barStool', x: 9.75, y: 10.6, rot: 90 },
        { type: 'barStool', x: 9.75, y: 11.4, rot: 90 },
        { type: 'pendantDome', x: 10.55, y: 10.6 },
        { type: 'pendantDome', x: 10.55, y: 11.4 },
      ],
    },
    dining: {
      finish: { walls: 'paint', wallColor: '#eeeae2', floor: 'wood' },
      items: [
        { type: 'diningTable', x: 10.6, y: 13.3, rot: 90, w: 1.8, d: 0.9, mat: 'teak' },
        { type: 'diningChair', x: 9.62, y: 12.85, rot: 90, fabric: 'linenCream' },
        { type: 'diningChair', x: 9.62, y: 13.75, rot: 90, fabric: 'linenCream' },
        { type: 'diningChair', x: 11.58, y: 12.85, rot: 270, fabric: 'linenCream' },
        { type: 'diningChair', x: 11.58, y: 13.75, rot: 270, fabric: 'linenCream' },
        { type: 'plantPot', x: 12.6, y: 15.05, size: 'medium' },
        { type: 'chandelierRing', x: 10.6, y: 13.3 },
        { type: 'plantPot', x: 9.35, y: 15.0, size: 'large' },
      ],
    },
    living: {
      finish: { walls: 'paint', wallColor: '#e7e1d6', floor: 'wood', curtains: 'drapeCream', windowFrame: 'ironBlack' },
      items: [
        { type: 'tvConsole', x: 2.36, y: 13.5, rot: 90, w: 1.8, d: 0.42, mat: 'walnut' },
        { type: 'tv', x: 2.15, y: 13.5, rot: 90, z: 1.35 },
        { type: 'sofa', x: 6.0, y: 13.35, rot: 270, w: 2.2, fabric: 'fabricSage', seats: 3 },
        { type: 'coffeeTable', x: 4.35, y: 13.35, rot: 90, w: 1.2, d: 0.65, mat: 'oak' },
        { type: 'rug', x: 4.3, y: 13.35, rot: 90, w: 2.6, d: 2.0, mat: 'rugWoolNeutral' },
        { type: 'armchairLounge', x: 4.4, y: 11.3, rot: 0 },
        { type: 'sideTable', x: 6.0, y: 11.78, rot: 270, w: 0.45, d: 0.45 },
        { type: 'tableLamp', x: 6.0, y: 11.78, z: 0.6 },
        { type: 'floorLamp', x: 6.85, y: 14.0, rot: 270 },
        { type: 'plantPot', x: 2.5, y: 15.0, size: 'large' },
        { type: 'plantPot', x: 8.65, y: 15.05, size: 'medium' },
        { type: 'ceilingFan', x: 4.4, y: 13.35 },
        { type: 'wallArt', x: 8.2, y: 10.075, rot: 0, z: 1.6, art: 'canvasArt2' },
      ],
    },
    // ------------------------------------------------------------ upper floor
    stairhall: {
      finish: { walls: 'paint', wallColor: '#ece7de', floor: 'wood' },
      items: [{ type: 'pendantDome', x: 3.3, y: 10.75 }],
    },
    corridor: {
      finish: { walls: 'paint', wallColor: '#ece7de', floor: 'wood' },
      items: [
        { type: 'wallArt', x: 12.1, y: 10.075, rot: 0, z: 1.55, art: 'canvasArt1' },
        { type: 'panelLed', x: 7.0, y: 10.75 },
        { type: 'panelLed', x: 11.0, y: 10.75 },
      ],
    },
    bed2: {
      finish: { walls: 'paint', wallColor: '#dfe5e0', floor: 'wood', curtains: 'drapeCream' },
      items: [
        { type: 'bed', x: 5.65, y: 8.0, rot: 90, size: 'queen', headboard: 'panel', fabric: 'fabricSage' },
        { type: 'nightstand', x: 4.8, y: 6.85, rot: 90 },
        { type: 'nightstand', x: 4.8, y: 9.15, rot: 90 },
        { type: 'tableLamp', x: 4.8, y: 6.85, z: 0.65 },
        { type: 'wardrobe', x: 7.625, y: 7.05, rot: 270, w: 1.2 },
        { type: 'kidsDesk', x: 6.3, y: 6.55, rot: 0, w: 1.2 },
        { type: 'rug', x: 6.2, y: 8.0, w: 1.4, d: 1.0, mat: 'rugSage' },
        { type: 'panelLed', x: 6.2, y: 8.0 },
      ],
    },
    bath: {
      finish: { walls: 'tile', floor: 'tileBath' },
      items: [
        { type: 'bathtubFreestanding', x: 9.0, y: 6.55, rot: 0, w: 1.6, d: 0.8 },
        { type: 'vanity', x: 9.675, y: 8.1, rot: 270, w: 1.0, d: 0.5, sinks: 1 },
        { type: 'toilet', x: 8.415, y: 8.3, rot: 90 },
        { type: 'towelRail', x: 8.075, y: 7.3, rot: 90 },
      ],
    },
    bed3: {
      finish: { walls: 'paint', wallColor: '#e8e0d2', floor: 'wood', curtains: 'drapeCream' },
      items: [
        { type: 'bed', x: 11.825, y: 8.45, rot: 270, size: 'single', headboard: 'panel', fabric: 'linenCream' },
        { type: 'nightstand', x: 12.625, y: 9.4, rot: 270 },
        { type: 'wardrobe', x: 10.375, y: 7.0, rot: 90, w: 1.2 },
        { type: 'kidsDesk', x: 11.6, y: 6.55, rot: 0, w: 1.2 },
        { type: 'toyChest', x: 10.3, y: 8.3, rot: 90 },
        { type: 'rug', x: 11.2, y: 7.9, w: 1.4, d: 0.9, mat: 'rugJute' },
        { type: 'panelLed', x: 11.5, y: 8.0 },
      ],
    },
    master: {
      finish: { walls: 'paint', wallColor: '#e6dccd', floor: 'wood', curtains: 'drapeCream', ceiling: 'tray', cove: true },
      items: [
        { type: 'bed', x: 3.75, y: 12.675, rot: 0, size: 'king', headboard: 'tufted', fabric: 'linenCream' },
        { type: 'nightstand', x: 2.425, y: 11.8, rot: 0 },
        { type: 'tableLamp', x: 2.425, y: 11.8, z: 0.65 },
        { type: 'benchTufted', x: 3.75, y: 14.05, rot: 0, w: 1.2 },
        { type: 'wardrobe', x: 7.625, y: 13.9, rot: 270, w: 1.8 },
        { type: 'armchairLounge', x: 6.3, y: 13.6, rot: 270 },
        { type: 'rug', x: 3.75, y: 13.0, w: 2.4, d: 2.8, mat: 'rugWoolNeutral' },
        { type: 'ceilingFan', x: 4.6, y: 13.4 },
      ],
    },
    ensuite: {
      finish: { walls: 'tile', floor: 'tileBath' },
      items: [
        { type: 'vanity', x: 10.15, y: 13.8, rot: 270, w: 1.6, d: 0.55, sinks: 2 },
        { type: 'toilet', x: 8.415, y: 14.0, rot: 90 },
        { type: 'showerGlass', x: 8.7, y: 14.8, rot: 180, w: 1.1, d: 1.1, sides: ['front', 'right'] },
        { type: 'towelRail', x: 8.075, y: 13.3, rot: 90 },
      ],
    },
    lounge: {
      finish: { walls: 'paint', wallColor: '#e9e3d8', floor: 'wood', curtains: 'drapeCream' },
      items: [
        { type: 'sofa', x: 11.05, y: 13.6, rot: 90, w: 2.0, seats: 2, fabric: 'fabricTaupe' },
        { type: 'coffeeTable', x: 12.0, y: 13.6, rot: 90, w: 1.0, d: 0.55, mat: 'oak' },
        { type: 'rug', x: 11.9, y: 13.6, rot: 90, w: 1.8, d: 1.4, mat: 'rugJute' },
        { type: 'bookcase', x: 12.675, y: 12.0, rot: 270, w: 0.8, d: 0.35 },
        { type: 'floorLamp', x: 10.8, y: 15.0 },
      ],
    },
  },

  // Furniture outside the rooms: keyed by the site item id (garden level) or with an explicit level
  areas: {
    carport: {
      items: [
        { type: 'sedan', x: 14.6, y: 5.0, rot: 0, color: '#2c3e50' },
        { type: 'mpv', x: 17.1, y: 5.0, rot: 0, color: '#e8e6e1' },
      ],
    },
    terrace: {
      items: [
        { type: 'outdoorSofa', x: 4.6, y: 17.7, rot: 180 },
        { type: 'plantPot', x: 2.4, y: 16.0, size: 'large' },
      ],
    },
    pergola: {
      items: [
        { type: 'diningTable', x: 10.25, y: 17.0, rot: 90, w: 1.6, d: 0.9, mat: 'teak' },
        { type: 'outdoorBench', x: 9.3, y: 17.0, rot: 90, w: 1.4, d: 0.4 },
        { type: 'outdoorBench', x: 11.2, y: 17.0, rot: 270, w: 1.4, d: 0.4 },
      ],
    },
    pool_deck: {
      items: [
        { type: 'lounger', x: 15.0, y: 21.3, rot: 0 },
        { type: 'lounger', x: 15.9, y: 21.3, rot: 0 },
        { type: 'umbrella', x: 15.45, y: 23.6 },
      ],
    },
  },
};
