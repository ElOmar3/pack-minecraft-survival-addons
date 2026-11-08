const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const bpDir = path.resolve(__dirname, '..', 'behavior_packs');
const mcpacksDir = path.resolve(__dirname, '..', 'mcpacks');

if (!fs.existsSync(mcpacksDir)) {
  fs.mkdirSync(mcpacksDir, { recursive: true });
}

const packs = fs.readdirSync(bpDir).filter(f => fs.statSync(path.join(bpDir, f)).isDirectory());

console.log(`Packaging ${packs.length} behavior packs into .mcpack files...`);

for (const pack of packs) {
  const packPath = path.join(bpDir, pack);
  const zipTarget = path.join(mcpacksDir, `${pack}.zip`);
  const mcpackTarget = path.join(mcpacksDir, `${pack}.mcpack`);
  
  if (fs.existsSync(zipTarget)) fs.unlinkSync(zipTarget);
  if (fs.existsSync(mcpackTarget)) fs.unlinkSync(mcpackTarget);
  
  // Compress to .zip then rename to .mcpack
  const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${packPath}\\*' -DestinationPath '${zipTarget}' -Force"`;
  try {
    execSync(psCmd, { stdio: 'pipe' });
    fs.renameSync(zipTarget, mcpackTarget);
    console.log(`✓ Generated ${pack}.mcpack`);
  } catch (err) {
    console.error(`✗ Error generating ${pack}.mcpack:`, err.message);
  }
}

console.log('Packaging complete!');
