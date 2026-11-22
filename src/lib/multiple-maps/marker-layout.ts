export interface BadgePosition {
  x: number;
  y: number;
  halfSize: number;
}

const gap = 4;
const directions = Array.from({ length: 16 }, (_, index) => {
  const angle = index * Math.PI / 8;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

function overlaps(a: BadgePosition, b: BadgePosition): boolean {
  const distance = a.halfSize + b.halfSize + gap;
  return Math.abs(a.x - b.x) < distance && Math.abs(a.y - b.y) < distance;
}

export function separateBadges(positions: BadgePosition[], width: number, height: number): BadgePosition[] {
  const visible = positions.filter(({ x, y }) => x >= 0 && x <= width && y >= 0 && y <= height);
  const placed = visible.filter((point) => !visible.some((other) => other !== point && overlaps(point, other)));
  const fixed = new Set(placed);

  return positions.map((point) => {
    if (fixed.has(point) || point.x < 0 || point.x > width || point.y < 0 || point.y > height) return point;
    if (!placed.some((other) => overlaps(point, other))) {
      placed.push(point);
      return point;
    }
    for (let radius = 12; radius <= 84; radius += 12) {
      for (const direction of directions) {
        const candidate = { x: point.x + radius * direction.x, y: point.y + radius * direction.y, halfSize: point.halfSize };
        const { x, y, halfSize } = candidate;
        if (x < halfSize + gap || x > width - halfSize - gap || y < halfSize + gap || y > height - halfSize - gap) continue;
        if (!placed.some((other) => overlaps(candidate, other))) {
          placed.push(candidate);
          return candidate;
        }
      }
    }
    // Keep the pin available through the location list or picker in very dense views.
    placed.push(point);
    return point;
  });
}
