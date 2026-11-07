/**
 * 手机拍出来的照片动辄 4–8MB，直接 base64 上传会又慢又容易撞 20MB 限制。
 * 这里统一缩到长边 maxSide（默认 1600）再转 JPEG，OCR 精度够、上传快一个数量级。
 */
export async function fileToJpegDataUrl(
  file: File | Blob,
  { maxSide = 1600, quality = 0.82 }: { maxSide?: number; quality?: number } = {},
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('这个浏览器画不了 canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close?.();
  }
}

/** https 或 localhost 才有 secure context；局域网 http 下 getUserMedia 会被浏览器拒绝 */
export function canUseInPageCamera(): boolean {
  return Boolean(
    window.isSecureContext &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function',
  );
}
