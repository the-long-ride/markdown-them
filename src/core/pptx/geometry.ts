import type { Box, PositionedItem, SlideSize, Transform } from './types';
import { DEFAULT_SLIDE_SIZE } from './types';
import { readNumberAttr } from './xml';

export function readSlideSize(sldSz: any): SlideSize {
  const width = readNumberAttr(sldSz, 'cx');
  const height = readNumberAttr(sldSz, 'cy');

  return width > 0 && height > 0 ? { width, height } : DEFAULT_SLIDE_SIZE;
}

export function readElementBox(xfrm: any): Box {
  return {
    x: readNumberAttr(xfrm?.off, 'x'),
    y: readNumberAttr(xfrm?.off, 'y'),
    width: readNumberAttr(xfrm?.ext, 'cx'),
    height: readNumberAttr(xfrm?.ext, 'cy'),
  };
}

export function composeGroupTransform(parent: Transform, xfrm: any): Transform {
  const off = xfrm?.off;
  const ext = xfrm?.ext;
  const childOff = xfrm?.chOff;
  const childExt = xfrm?.chExt;
  const groupX = readNumberAttr(off, 'x');
  const groupY = readNumberAttr(off, 'y');
  const groupWidth = readNumberAttr(ext, 'cx');
  const groupHeight = readNumberAttr(ext, 'cy');
  const childX = readNumberAttr(childOff, 'x');
  const childY = readNumberAttr(childOff, 'y');
  const childWidth = readNumberAttr(childExt, 'cx');
  const childHeight = readNumberAttr(childExt, 'cy');
  const scaleX = childWidth > 0 && groupWidth > 0 ? groupWidth / childWidth : 1;
  const scaleY = childHeight > 0 && groupHeight > 0 ? groupHeight / childHeight : 1;

  return {
    x: parent.x + (groupX - childX * scaleX) * parent.scaleX,
    y: parent.y + (groupY - childY * scaleY) * parent.scaleY,
    scaleX: parent.scaleX * scaleX,
    scaleY: parent.scaleY * scaleY,
  };
}

export function applyTransform(transform: Transform, box: Box): Box {
  return {
    x: transform.x + box.x * transform.scaleX,
    y: transform.y + box.y * transform.scaleY,
    width: box.width * transform.scaleX,
    height: box.height * transform.scaleY,
  };
}

export function comparePosition(
  a: PositionedItem,
  b: PositionedItem,
  slideSize: SlideSize,
): number {
  const yTolerance = Math.max(1, slideSize.height * 0.025);
  const xTolerance = Math.max(1, slideSize.width * 0.015);
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

export function horizontalOverlap(left: PositionedItem, right: PositionedItem): number {
  return Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
}

export function centerX(item: PositionedItem): number {
  return item.x + item.width / 2;
}

export function isSameVisualColumn(left: PositionedItem, right: PositionedItem): boolean {
  const overlap = horizontalOverlap(left, right);
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
