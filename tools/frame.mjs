// Some of the game's map banners (Abyss, Breeze, Lotus and Summit) come with a thin white frame
// drawn into the picture. `frameOf` finds it, so prepare-art.mjs can cut it off and every banner
// fills its card edge to edge.
import sharp from 'sharp';

/** The widest frame looked for, in px, and how light (0–255) every pixel of a frame line is. */
const MOST = 4, LIGHT = 200;

/** How many px of light frame are on each side of an image (all 0 when there's none). */
export async function frameOf(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const dark = (x, y) => { const i = (y * w + x) * c; return Math.min(data[i], data[i + 1], data[i + 2]) < LIGHT; };
  const lightRow = (y) => { for (let x = 0; x < w; x++) if (dark(x, y)) return false; return true; };
  const lightCol = (x) => { for (let y = 0; y < h; y++) if (dark(x, y)) return false; return true; };
  const count = (light, from, step) => { let n = 0; while (n < MOST && light(from + n * step)) n++; return n; };
  return { top: count(lightRow, 0, 1), bottom: count(lightRow, h - 1, -1), left: count(lightCol, 0, 1), right: count(lightCol, w - 1, -1), width: w, height: h };
}

/** The image without its light frame, ready for more sharp steps. */
export async function withoutFrame(file) {
  const f = await frameOf(file);
  const img = sharp(file);
  if (!f.top && !f.bottom && !f.left && !f.right) return img;
  return img.extract({ left: f.left, top: f.top, width: f.width - f.left - f.right, height: f.height - f.top - f.bottom });
}
