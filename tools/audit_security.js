const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    if (item === '.git' || item === 'node_modules' || item === 'mcpacks') continue;
    const p = path.join(dir, item);
    if (fs.statSync(p).isDirectory()) files = files.concat(walk(p));
    else files.push(p);
  }
  return files;
}

const files = walk('.');
const suspicious = [];

const patterns = [
  { name: 'GitHub Token', regex: /gh[pous]_[A-Za-z0-9_]{30,}/ },
  { name: 'Discord Webhook', regex: /discord(app)?\.com\/api\/webhooks/ },
  { name: 'Private Key', regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/ },
  { name: 'Tebex Secret', regex: /tebex.*secret.*[a-f0-9]{32,}/i },
  { name: 'Real IPv4', regex: /\b(?!127\.0\.0\.1|0\.0\.0\.0|1\.26\.|2\.11\.|2\.3\.|1\.0\.|1\.1\.|1\.2\.)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/ }
];

for (const file of files) {
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.zip') || file.endsWith('.db') || file.endsWith('.mcpack')) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const p of patterns) {
    const match = content.match(p.regex);
    if (match) {
      suspicious.push({ file, type: p.name, match: match[0].substring(0, 50) });
    }
  }
}

console.log('Total suspicious matches found:', suspicious.length);
if (suspicious.length > 0) {
  console.log(JSON.stringify(suspicious, null, 2));
} else {
  console.log('✅ ZERO secrets or private credentials found across the entire repository!');
}
