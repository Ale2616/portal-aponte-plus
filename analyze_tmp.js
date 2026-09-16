const sharp = require('sharp');
const path = 'C:/Users/Bienvenido Alejandro/.gemini/antigravity-ide/brain/f9969bae-be98-4d5b-8cad-9ef301d3d299/.user_uploaded/media_1789524750381.png';

async function run() {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  console.log('Dimensions:', width, 'x', height, 'channels:', channels);

  // Let's print an ASCII map of features
  for (let y = 0; y < height; y++) {
    let rowStr = '';
    for (let x = 0; x < width; x += 10) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      // Dark background: around [2, 6, 24]
      if (r < 15 && g < 20 && b < 35) {
        rowStr += ' ';
      } else if (r < 25 && g > 40 && b > 60) {
        // Teal background
        rowStr += '#';
      } else {
        // Light / white / highlight feature
        rowStr += '*';
      }
    }
    console.log(String(y).padStart(2, '0') + ': ' + rowStr);
  }
}

run().catch(console.error);
