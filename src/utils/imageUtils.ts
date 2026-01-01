import { AspectRatio } from '@/types';

/**
 * Get canvas dimensions based on aspect ratio
 */
export const getCanvasDimensions = (aspectRatio: AspectRatio): { width: number; height: number } => {
  if (aspectRatio === '9:16') {
    return { width: 720, height: 1280 };
  }
  return { width: 1280, height: 720 };
};

/**
 * Detects and trims white/light borders from an image, returning the content bounds.
 * Uses a brightness threshold to detect near-white pixels.
 */
function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  threshold: number = 240 // pixels brighter than this are considered "white"
): { x: number; y: number; w: number; h: number } {
  // Handle very small images or edge cases
  if (width < 3 || height < 3) {
    return { x: 0, y: 0, w: width, h: height };
  }

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Check if pixel is NOT white/near-white
        if (r < threshold || g < threshold || b < threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // If no content found, return full frame
    if (maxX <= minX || maxY <= minY) {
      return { x: 0, y: 0, w: width, h: height };
    }

    // Add small padding and clamp to bounds
    const padding = 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch {
    // If getImageData fails (e.g., in test environment), return full frame
    return { x: 0, y: 0, w: width, h: height };
  }
}

/**
 * Slices a 3x3 grid image into 9 individual base64 images.
 * Automatically trims white borders from each frame.
 */
export const sliceGridImage = (base64Image: string, aspectRatio: AspectRatio = '16:9'): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const frames: string[] = [];
      const cols = 3;
      const rows = 3;
      const frameWidth = img.width / cols;
      const frameHeight = img.height / rows;

      // Temp canvas for slicing
      const sliceCanvas = document.createElement('canvas');
      const sliceCtx = sliceCanvas.getContext('2d');

      // Output canvas for final frames (with black background)
      const outputCanvas = document.createElement('canvas');
      const outputCtx = outputCanvas.getContext('2d');

      if (!sliceCtx || !outputCtx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      sliceCanvas.width = frameWidth;
      sliceCanvas.height = frameHeight;

      // Target dimensions based on aspect ratio
      const { width: targetWidth, height: targetHeight } = getCanvasDimensions(aspectRatio);
      outputCanvas.width = targetWidth;
      outputCanvas.height = targetHeight;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // First, slice the frame from the grid
          sliceCtx.clearRect(0, 0, frameWidth, frameHeight);
          sliceCtx.drawImage(
            img,
            c * frameWidth,
            r * frameHeight,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );

          // Detect content bounds (trim white borders)
          const bounds = detectContentBounds(sliceCtx, frameWidth, frameHeight);

          // Draw to output canvas with black background, scaling content to fill
          outputCtx.fillStyle = 'black';
          outputCtx.fillRect(0, 0, targetWidth, targetHeight);

          // Scale and center the content to fill the output while maintaining aspect ratio
          const contentAspect = bounds.w / bounds.h;
          const targetAspect = targetWidth / targetHeight;

          let drawWidth, drawHeight, drawX, drawY;

          if (contentAspect > targetAspect) {
            // Content is wider - fit to width
            drawWidth = targetWidth;
            drawHeight = targetWidth / contentAspect;
            drawX = 0;
            drawY = (targetHeight - drawHeight) / 2;
          } else {
            // Content is taller - fit to height
            drawHeight = targetHeight;
            drawWidth = targetHeight * contentAspect;
            drawX = (targetWidth - drawWidth) / 2;
            drawY = 0;
          }

          outputCtx.drawImage(
            sliceCanvas,
            bounds.x,
            bounds.y,
            bounds.w,
            bounds.h,
            drawX,
            drawY,
            drawWidth,
            drawHeight
          );

          frames.push(outputCanvas.toDataURL('image/png'));
        }
      }
      resolve(frames);
    };
    img.onerror = (e) => reject(e);
    img.src = base64Image;
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};
