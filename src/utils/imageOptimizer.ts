// Helper for compressing/resizing images to high quality WebP/JPEG for fast storage & mobile display
export async function optimizeImageFile(
  fileOrBase64: File | Blob | string,
  maxWidth = 1200,
  maxHeight = 1800,
  quality = 0.92
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let { width, height } = img;

      // Calculate aspect ratio preserving resize
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrBase64 === 'string' ? fileOrBase64 : '');
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Try webp first, fallback to jpeg
      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/webp', quality);
      } catch {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(dataUrl);
    };

    img.onerror = () => {
      if (typeof fileOrBase64 === 'string') {
        resolve(fileOrBase64);
      } else {
        reject(new Error('Görsel yüklenemedi.'));
      }
    };

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    }
  });
}

/**
 * Optimizes custom badge icons to 256x256 pixels while strictly preserving transparency (alpha channel).
 * Converts user-uploaded or pasted icons into lightweight PNG/WebP data URLs.
 */
export async function optimizeBadgeIcon(
  fileOrBase64: File | Blob | string,
  targetSize = 512
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let { width, height } = img;
      if (width === 0 || height === 0) {
        resolve(typeof fileOrBase64 === 'string' ? fileOrBase64 : '');
        return;
      }

      // Preserve aspect ratio inside targetSize x targetSize
      const ratio = Math.min(targetSize / width, targetSize / height, 1);
      const targetW = Math.max(1, Math.round(width * ratio));
      const targetH = Math.max(1, Math.round(height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrBase64 === 'string' ? fileOrBase64 : '');
        return;
      }

      // Clear with transparency
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Prefer PNG for flawless transparency preservation
      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch {
        try {
          dataUrl = canvas.toDataURL('image/webp', 0.9);
        } catch {
          dataUrl = canvas.toDataURL();
        }
      }
      resolve(dataUrl);
    };

    img.onerror = () => {
      if (typeof fileOrBase64 === 'string') {
        resolve(fileOrBase64);
      } else {
        reject(new Error('Rozet görseli yüklenemedi.'));
      }
    };

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    }
  });
}
