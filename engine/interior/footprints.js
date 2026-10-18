// Footprint parts for L-shaped furniture, shared by the colliders (place.js) and the interior check.
// Rects are [x0, z0, x1, z1] in the builder's local frame (+X width, +Z front), centred on the item's
// w × d footprint. null means the plain w × d rectangle.
export function footprintParts(type, p, w, d) {
  if (type === 'sofaSectional') {
    const dd = p.depth ?? 0.95;
    const side = p.corner === 'left' ? [-w / 2, -w / 2 + dd] : [w / 2 - dd, w / 2];
    // main run along the back, chaise down one end
    return [[-w / 2, -d / 2, w / 2, -d / 2 + dd], [side[0], -d / 2 + dd, side[1], d / 2]];
  }
  if (type === 'deskExecutive' && p.ret) {
    const D = p.depth ?? 0.9, rd = p.retDepth ?? 0.6;
    if (p.ret <= D) return null;
    const side = p.retSide === 'left' ? [-w / 2, -w / 2 + rd] : [w / 2 - rd, w / 2];
    // main top at the back, return wing beside the user
    return [[-w / 2, -d / 2, w / 2, -d / 2 + D], [side[0], -d / 2 + D, side[1], d / 2]];
  }
  return null;
}
