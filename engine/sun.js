// Sun direction at the project's latitude (project.json location.lat) on the 15th of `month`.
// Returns a unit vector in world space (X east, Y up, Z south).
import { LATITUDE } from './config.js';
const LAT = (LATITUDE ?? -7) * Math.PI / 180;

export function sunDirection(hour, month) {
  const day = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1];
  const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365);
  const H = (hour - 12) * 15 * Math.PI / 180;
  const sinAlt = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  let cosAz = (Math.sin(decl) - sinAlt * Math.sin(LAT)) / (Math.cos(alt) * Math.cos(LAT));
  cosAz = Math.max(-1, Math.min(1, cosAz));
  let az = Math.acos(cosAz);        // from north, towards east
  if (H > 0) az = 2 * Math.PI - az;  // afternoon: west of north
  const east = Math.sin(az) * Math.cos(alt), north = Math.cos(az) * Math.cos(alt), up = Math.sin(alt);
  return { x: east, y: up, z: -north };
}
