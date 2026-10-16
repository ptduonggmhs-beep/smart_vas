/**
 * Workaround for Windows OneDrive / NTFS Reparse Points in @expo/metro-file-map.
 *
 * In Node.js on Windows (especially when projects are located in OneDrive / cloud-synced folders),
 * OneDrive cloud placeholder reparse points cause fs.Dirent.isSymbolicLink() to return true,
 * even though the file is a regular file and NOT a symbolic link.
 *
 * When @expo/metro-file-map tries to resolve these "symlinks", fs.readlinkSync fails with EINVAL,
 * causing Metro to conclude that files like "expo/src/Expo.ts" do not exist:
 * "Unable to resolve 'expo' from 'index.ts'".
 *
 * This script patches all copies of @expo/metro-file-map in node_modules to verify with
 * fs.lstatSync before treating a Dirent as a symbolic link on Windows.
 */

const fs = require('fs');
const path = require('path');

function patchFile(filePath, transforms) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const { search, replace, test } of transforms) {
    if (test && test.test(content)) {
      continue; // Already patched
    }
    if (content.includes(search)) {
      content = content.replace(search, replace);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-metro-file-map] Patched ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  return false;
}

function findPackages(dir, name, results = []) {
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.name === name) {
        results.push(fullPath);
      } else if (entry.name.startsWith('@') || entry.name === 'node_modules') {
        findPackages(fullPath, name, results);
      } else {
        const nestedNodeModules = path.join(fullPath, 'node_modules');
        if (fs.existsSync(nestedNodeModules)) {
          findPackages(nestedNodeModules, name, results);
        }
      }
    }
  } catch {}
  return results;
}

const fallbackPatch = [
  {
    test: /const st = _fs\(\)\.default\.lstatSync\(childAbsolutePath\);/,
    search: `            if (entry.isDirectory()) {`,
    replace: `            let isDirectory = entry.isDirectory();
            let isSymbolicLink = entry.isSymbolicLink();
            let isFile = entry.isFile();
            if (process.platform === 'win32' && isSymbolicLink) {
                try {
                    const st = _fs().default.lstatSync(childAbsolutePath);
                    isSymbolicLink = st.isSymbolicLink();
                    isDirectory = st.isDirectory();
                    isFile = st.isFile();
                } catch {}
            }
            if (isDirectory) {`,
  },
  {
    test: /} else if \(isSymbolicLink\) {/,
    search: `} else if (entry.isSymbolicLink()) {`,
    replace: `} else if (isSymbolicLink) {`,
  },
  {
    test: /} else if \(isFile\) {/,
    search: `} else if (entry.isFile()) {`,
    replace: `} else if (isFile) {`,
  },
];

const indexPatch = [
  {
    test: /const st = _fs\(\)\.lstatSync\(file\);/,
    search: `                    const isDirectory = entry.isDirectory();
                    if (isDirectory && (name === '.git' || name === '.hg' || name === '.cxx')) {
                        continue;
                    }
                    const file = directory + _path().sep + name;
                    const isSymbolicLink = entry.isSymbolicLink();`,
    replace: `                    let isDirectory = entry.isDirectory();
                    const file = directory + _path().sep + name;
                    let isSymbolicLink = entry.isSymbolicLink();
                    if (process.platform === 'win32' && isSymbolicLink) {
                        try {
                            const st = _fs().lstatSync(file);
                            isSymbolicLink = st.isSymbolicLink();
                            isDirectory = st.isDirectory();
                        } catch {}
                    }
                    if (isDirectory && (name === '.git' || name === '.hg' || name === '.cxx')) {
                        continue;
                    }`,
  },
];

const metroFileMapDirs = findPackages(path.resolve('node_modules'), 'metro-file-map');

for (const pkgDir of metroFileMapDirs) {
  const fallbackPath = path.join(pkgDir, 'build', 'crawlers', 'node', 'fallback.js');
  const indexPath = path.join(pkgDir, 'build', 'crawlers', 'node', 'index.js');
  patchFile(fallbackPath, fallbackPatch);
  patchFile(indexPath, indexPatch);
}
