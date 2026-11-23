import type { Box, PositionedItem, OrderedXmlNode } from './types';
import { readAttr } from './xml';
import { comparePosition as compareSharedPosition } from '../shared/geometry';

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
  return compareSharedPosition(a, b, pageSize, 0.01);
}
