import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prismaDir = join(__dirname, '..', 'src', 'generated', 'prisma');

function addJsExtensions(content) {
  // Fix import statements: from "./something" to from "./something.js"
  content = content.replace(
    /from\s+(['"])(\.[^'"]+)\1/g,
    (match, quote, path) => {
      if (path.endsWith('.js') || path.endsWith('.json')) {
        return match;
      }
      return `from ${quote}${path}.js${quote}`;
    }
  );

  // Fix export statements: export * from "./something" to export * from "./something.js"
  content = content.replace(
    /export\s+\*\s+(?:as\s+\w+\s+)?from\s+(['"])(\.[^'"]+)\1/g,
    (match, quote, path) => {
      if (path.endsWith('.js') || path.endsWith('.json')) {
        return match;
      }
      const prefix = match.substring(0, match.lastIndexOf(path));
      return `${prefix}${path}.js${quote}`;
    }
  );

  return content;
}

function processDirectory(dir) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      console.log(`Processing ${fullPath}`);
      const content = readFileSync(fullPath, 'utf-8');
      const fixed = addJsExtensions(content);
      if (content !== fixed) {
        writeFileSync(fullPath, fixed, 'utf-8');
        console.log(`  ✓ Fixed imports in ${entry}`);
      }
    }
  }
}

console.log('Fixing Prisma imports to include .js extensions...');
processDirectory(prismaDir);
console.log('Done!');
