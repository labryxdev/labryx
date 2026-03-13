const sharp = require('C:/Users/Automation/AppData/Roaming/npm/node_modules/openclaw/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(process.env.USERPROFILE, '.openclaw', 'workspace', 'labryx', 'assets');

Promise.all([
  sharp(path.join(dir, 'logo.svg')).resize(400, 400).png().toFile(path.join(dir, 'logo.png')),
  sharp(path.join(dir, 'twitter-banner.svg')).resize(1500, 500).png().toFile(path.join(dir, 'twitter-banner.png'))
]).then(() => console.log('Done: logo.png + twitter-banner.png'))
  .catch(e => console.error('Error:', e.message));
