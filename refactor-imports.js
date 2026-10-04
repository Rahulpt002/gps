import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, 'apps/web/src');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p, callback);
    } else {
      if (p.endsWith('.ts') || p.endsWith('.tsx')) {
        callback(p);
      }
    }
  });
}

walk(srcDir, file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace relative imports to core files with @gps/core
  const regex = /from\s+['"](?:\.\.\/|\.\/)+(?:utils\/geo|utils\/speed|utils\/distance|utils\/session|utils\/elevation|types\/gps|types\/trip|constants\/tracking)['"]/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, "from '@gps/core'");
    changed = true;
  }
  
  // also need to replace imports to constants/storage. Wait, storage wasn't moved.
  // tracking was moved as @gps/core.

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
