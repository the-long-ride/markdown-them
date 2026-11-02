import type { Box, PositionedItem, OrderedXmlNode } from './types';
import { readAttr } from './xml';

export function readUnit(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(cm|in|mm|pt|px)?$/i);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = (match[2] || 'in').toLowerCase();
  if (!Number.isFinite(amount)) {
    return 0;
  }

  switch (unit) {
    case 'cm':
      return amount / 2.54;
    case 'mm':
      return amount / 25.4;
    case 'pt':
      return amount / 72;
    case 'px':
      return amount / 96;
    default:
      return amount;
  }
}

export function readFrameBox(frame: OrderedXmlNode): Box {
  return {
    x: readUnit(readAttr(frame, 'x')),
    y: readUnit(readAttr(frame, 'y')),
    width: readUnit(readAttr(frame, 'width')),
    height: readUnit(readAttr(frame, 'height')),
  };
}

export function readPageBox(page: OrderedXmlNode): Box | undefined {
  const width = readUnit(readAttr(page, 'width'));
  const height = readUnit(readAttr(page, 'height'));
  return width > 0 && height > 0 ? { x: 0, y: 0, width, height } : undefined;
}

export function comparePosition(a: PositionedItem, b: PositionedItem, pageSize: Box): number {
  const yTolerance = Math.max(0.01, pageSize.height * 0.025);
  const xTolerance = Math.max(0.01, pageSize.width * 0.015);
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

export function centerX(item: PositionedItem): number {
  return item.x + item.width / 2;
}

export function isSameVisualColumn(left: PositionedItem, right: PositionedItem): boolean {
  const overlap = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const minWidth = Math.min(left.width, right.width);
  const overlapRatio = minWidth > 0 ? overlap / minWidth : 0;
  const centerDistance = Math.abs(centerX(left) - centerX(right));
  return overlapRatio >= 0.35 || centerDistance <= Math.max(left.width, right.width) * 0.42;
}

export function unionBoxes(items: PositionedItem[]): Box {
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
