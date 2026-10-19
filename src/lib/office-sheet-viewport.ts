/** Keyboard geometry only; pinch zoom must not reposition the modal. */
export function officeSheetViewport(
  viewport: { height: number; offsetTop: number; scale: number },
  layoutHeight: number,
) {
  const { height, offsetTop, scale } = viewport;
  if (
    ![height, offsetTop, scale, layoutHeight].every(Number.isFinite) ||
    height <= 0 ||
    layoutHeight <= 0 ||
    scale < 0.99 ||
    scale > 1.01
  )
    return null;
  const gap = Math.max(0, layoutHeight - height - offsetTop);
  return {
    height: Math.floor(height * 0.92),
    bottom: gap > 100 ? Math.floor(gap) : 0,
    top: Math.floor(Math.max(0, offsetTop) + height * 0.04),
  };
}
