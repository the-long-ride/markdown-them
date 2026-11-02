import { execSync } from 'node:child_process';
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
const bundleDir = path.join(releaseDir, 'bundle');
const outDir = path.join(rootDir, 'dist', 'installers');

await mkdir(outDir, { recursive: true });

// Read application version
let appVersion = '1.3.2';
try {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  if (pkg.version) {
    appVersion = pkg.version;
  }
} catch {
  // Use default
}

function runCommand(cmd, cwd) {
  try {
    execSync(cmd, { cwd: cwd || rootDir, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.warn(`[Warning] Command failed: "${cmd}" - ${err.message}`);
    return false;
  }
}

async function stageWindowsPortable() {
  const exePath = path.join(releaseDir, 'markdown-them.exe');
  if (!existsSync(exePath)) {
    return;
  }

  const portableExeName = `markdown-them_${appVersion}_windows_x64_portable.exe`;
  const portableZipName = `markdown-them_${appVersion}_windows_x64_portable.zip`;
  const destExe = path.join(outDir, portableExeName);
  const destZip = path.join(outDir, portableZipName);

  await cp(exePath, destExe);
  console.log(`[Windows Portable Exe] Staged ${portableExeName} -> dist/installers/`);

  // Package into zip archive
  const zipCreated = runCommand(`tar -a -c -f "${destZip}" -C "${releaseDir}" markdown-them.exe`);
  if (zipCreated) {
    console.log(`[Windows Portable Zip] Staged ${portableZipName} -> dist/installers/`);
  }
}

async function stageMacosPortable() {
  const candidateDirs = [
    path.join(bundleDir, 'macos', 'markdown-them.app'),
    path.join(bundleDir, 'osx', 'markdown-them.app'),
    path.join(bundleDir, 'macos', 'Markdown Them.app'),
    path.join(bundleDir, 'osx', 'Markdown Them.app'),
  ];

  let appDir = candidateDirs.find((dir) => existsSync(dir));
  if (!appDir) {
    return;
  }

  const parentDir = path.dirname(appDir);
  const appBaseName = path.basename(appDir);
  const tarName = `markdown-them_${appVersion}_macos_portable.tar.gz`;
  const zipName = `markdown-them_${appVersion}_macos_portable.zip`;
  const destTar = path.join(outDir, tarName);
  const destZip = path.join(outDir, zipName);

  // Preserve permissions and symlinks with tar
  const tarSuccess = runCommand(`tar -czf "${destTar}" -C "${parentDir}" "${appBaseName}"`);
  if (tarSuccess) {
    console.log(`[macOS Portable Tar] Staged ${tarName} -> dist/installers/`);
  }

  // Create zip for user convenience
  const zipSuccess = runCommand(`tar -a -c -f "${destZip}" -C "${parentDir}" "${appBaseName}"`);
  if (zipSuccess) {
    console.log(`[macOS Portable Zip] Staged ${zipName} -> dist/installers/`);
  }
}

async function scanAndCopyBundle(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanAndCopyBundle(fullPath);
      } else if (/\.(deb|exe|msi|AppImage|dmg|zip|tar\.gz)$/i.test(entry.name)) {
        const destPath = path.join(outDir, entry.name);
        await cp(fullPath, destPath);
        console.log(`[Bundle Installer Copied] ${entry.name} -> dist/installers/`);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

// 1. Stage Windows portable artifacts if present
await stageWindowsPortable();

// 2. Stage macOS portable artifacts if present
await stageMacosPortable();

// 3. Scan bundle directory for Linux .deb (or other bundles)
if (existsSync(bundleDir)) {
  await scanAndCopyBundle(bundleDir);
}

console.log('Desktop installer staging complete.');
