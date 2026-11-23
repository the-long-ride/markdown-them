import type { Box, PositionedItem, SlideSize, Transform } from './types';
import { DEFAULT_SLIDE_SIZE } from './types';
import { readNumberAttr } from './xml';
import { comparePosition as compareSharedPosition } from '../shared/geometry';

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
  return compareSharedPosition(a, b, slideSize, 1);
}
