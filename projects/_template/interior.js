// Interior of the house: finishes and furniture per room, and furniture outside the rooms ('areas',
// keyed by a site item id, e.g. a carport). The wizard fills this in. Field reference and the
// furniture catalogue: docs/SCHEMA.md · example: projects/sample-house/interior.js
export default {
  version: '0.1',
  rooms: {
    living: {
      finish: { walls: 'paint', wallColor: '#e7e1d6', floor: 'wood' },
      items: [],
    },
  },
  areas: {},
};
