/** CSS-pixel bounds share the layout viewport's origin, even when a keyboard pans it. */
export function messagingViewportHeight({ shellTop, viewportHeight, viewportOffsetTop = 0, bottomNavigationTop }: {
  shellTop: number;
  viewportHeight: number;
  viewportOffsetTop?: number;
  bottomNavigationTop?: number;
}): number {
  const visibleBottom = viewportOffsetTop + viewportHeight;
  const bottom = bottomNavigationTop === undefined ? visibleBottom : Math.min(visibleBottom, bottomNavigationTop);
  return Math.max(0, bottom - shellTop);
}
