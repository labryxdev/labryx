const sharp = require('C:/Users/Automation/AppData/Roaming/npm/node_modules/openclaw/node_modules/sharp');
const path = require('path');
const landingDir = path.join(process.env.USERPROFILE, '.openclaw', 'workspace', 'labryx', 'landing');
sharp(path.join(landingDir, 'og-image.svg'))
  .resize(1200, 630)
  .png()
  .toFile(path.join(landingDir, 'og-image.png'))
  .then(() => console.log('Done: og-image.png'))
  .catch(e => console.error('Error:', e.message));
