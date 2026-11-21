let sharp: any = null;
try {
  sharp = require('sharp');
} catch (err: any) {
  console.warn(
    '⚠️ [ImageProcessor] Native sharp module not loaded on this architecture (' +
      process.arch +
      '). Falling back to pure-JS header parsing. (Docker 64-bit uses full native Sharp).'
  );
}

export interface ImageProcessingResult {
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    space?: string;
    channels?: number;
    hasAlpha?: boolean;
    aspectRatio?: number;
    engine?: string;
  };
  thumbnailBuffer: Buffer;
  thumbnailMimeType: string;
}

/**
 * Extracts basic dimensions from PNG/JPEG/GIF headers if native sharp is unavailable
 */
function extractFallbackDimensions(buffer: Buffer): { width?: number; height?: number; format?: string } {
  try {
    // PNG Check: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, format: 'png' };
    }

    // GIF Check: GIF87a or GIF89a
    if (buffer.length > 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height, format: 'gif' };
    }

    // JPEG Check: FF D8 FF
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        // SOF0 (0xC0) or SOF2 (0xC2)
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height, format: 'jpeg' };
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
      return { format: 'jpeg' };
    }
  } catch {
    // ignore parse error in fallback
  }

  return {};
}

export async function processImage(fileBuffer: Buffer): Promise<ImageProcessingResult> {
  if (sharp) {
    try {
      const image = sharp(fileBuffer);
      const meta = await image.metadata();

      const width = meta.width;
      const height = meta.height;
      const aspectRatio = width && height ? parseFloat((width / height).toFixed(2)) : undefined;

      const thumbnailBuffer = await sharp(fileBuffer)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      return {
        metadata: {
          width,
          height,
          format: meta.format,
          space: meta.space,
          channels: meta.channels,
          hasAlpha: meta.hasAlpha,
          aspectRatio,
          engine: 'sharp-native',
        },
        thumbnailBuffer,
        thumbnailMimeType: 'image/webp',
      };
    } catch (sharpErr: any) {
      console.warn('[ImageProcessor] Sharp processing failed, falling back:', sharpErr.message);
    }
  }

  // Fallback for architectures where libvips/sharp is unavailable
  const fallbackMeta = extractFallbackDimensions(fileBuffer);
  const width = fallbackMeta.width;
  const height = fallbackMeta.height;
  const aspectRatio = width && height ? parseFloat((width / height).toFixed(2)) : undefined;

  return {
    metadata: {
      width,
      height,
      format: fallbackMeta.format || 'image',
      aspectRatio,
      engine: 'js-header-fallback',
    },
    thumbnailBuffer: fileBuffer, // preserve original as thumbnail preview in fallback
    thumbnailMimeType: fallbackMeta.format ? `image/${fallbackMeta.format}` : 'image/jpeg',
  };
}
