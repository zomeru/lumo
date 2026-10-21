/** Source rectangle shared by the circular preview and the saved square image. */
export function avatarCrop(width: number, height: number, zoom: number, x: number, y: number) {
  const side = Math.min(width, height) / Math.max(1, Math.min(3, zoom));
  return {
    side,
    left: ((width - side) * Math.max(0, Math.min(100, x))) / 100,
    top: ((height - side) * Math.max(0, Math.min(100, y))) / 100,
  };
}
