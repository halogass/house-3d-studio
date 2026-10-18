export default {
  rooms: {
    hall: { finish: { walls: 'paint' }, items: [] },
    room: { finish: { walls: 'wainscot', ceiling: 'coffered' }, items: [{ type: 'sofa', x: 8.5, y: 2.65, rot: 0, w: 2.2 }] },
    stairs: { finish: { walls: 'paint' }, items: [] },
    back: { finish: { walls: 'panel', panelColor: 'walnut', ceiling: 'beams' }, items: [{ type: 'deskExecutive', x: 8.5, y: 11.3, rot: 180 }] },
    landing: { finish: { walls: 'paint' }, items: [] },
    bed: { finish: { walls: 'wallpaper', ceiling: 'tray', cove: true }, items: [{ type: 'bed', x: 9.77, y: 4.5, rot: 270, size: 'queen' }] },
  },
  areas: { yard: { items: [{ type: 'hatchback', x: 12.5, y: 9.5, rot: 180 }] } },
};
