export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  x: number;
  y: number;
}

export interface PositionedBox extends Box {
  order: number;
}

export function comparePosition(
  a: PositionedBox,
  b: PositionedBox,
  size: Size,
  minTolerance: number,
): number {
  const yTolerance = Math.max(minTolerance, size.height * 0.025);
  const xTolerance = Math.max(minTolerance, size.width * 0.015);
  const yDiff = a.y - b.y;

  if (Math.abs(yDiff) > yTolerance) {
    return yDiff;
  }

  const xDiff = a.x - b.x;
  if (Math.abs(xDiff) > xTolerance) {
    return xDiff;
  }

  return a.order - b.order;
}

export function horizontalOverlap(left: Box, right: Box): number {
  return Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
}

export function centerX(item: Box): number {
  return item.x + item.width / 2;
}

export function isSameVisualColumn(left: Box, right: Box): boolean {
  const overlap = horizontalOverlap(left, right);
  const minWidth = Math.min(left.width, right.width);
  const overlapRatio = minWidth > 0 ? overlap / minWidth : 0;
  const centerDistance = Math.abs(centerX(left) - centerX(right));

  return overlapRatio >= 0.35 || centerDistance <= Math.max(left.width, right.width) * 0.42;
}

export function unionBoxes(items: Box[]): Box {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
