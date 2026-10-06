import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Integrity/review only. No cloud SDK, credentials, restore command or deployment.
export async function verifyRollbackPackage(manifestFile) {
  if (!path.isAbsolute(manifestFile)) throw new Error('Absolute private manifest required.');
  const manifestPath = await realpath(manifestFile);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.purpose !== 'v1-rollback-review' || !['frontend', 'functions', 'maintenance-bridges'].includes(manifest.component)
    || manifest.projectId !== 'takeme-52b80' || manifest.storageBucket !== 'takeme-52b80.firebasestorage.app'
    || manifest.siteUrl !== 'https://takeme.my' || manifest.deploymentApproved !== false || manifest.productionModified !== false
    || manifest.deletionEnabled !== false || manifest.paymentsEnabled !== false || manifest.publicationApproved !== false
    || typeof manifest.baselineVerified !== 'boolean' || !Array.isArray(manifest.files) || !manifest.files.length
    || manifest.files.length > 20_000 || !path.isAbsolute(manifest.root)) throw new Error('Rollback review identity/safety contract invalid.');
  const root = await realpath(manifest.root);
  for (let parent = root;; parent = path.dirname(parent)) {
    try { await lstat(path.join(parent, '.git')); throw new Error('Rollback output must remain outside Git.'); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    if (parent === path.dirname(parent)) break;
  }
  const names = new Set();
  for (const item of manifest.files) {
    if (!item || typeof item.path !== 'string' || !item.path || path.isAbsolute(item.path)
      || item.path.split(/[\\/]/).some(part => part === '..' || part === 'node_modules' || part === '.git' || part.startsWith('.env'))
      || names.has(item.path) || !/^[0-9a-f]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) throw new Error('Unsafe/duplicate inventory member.');
    names.add(item.path);
    const file = path.join(root, item.path), resolved = await realpath(file), stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !resolved.startsWith(root + path.sep) || stat.size !== item.bytes) throw new Error('Rollback member type/size/path mismatch.');
    if (createHash('sha256').update(await readFile(file)).digest('hex') !== item.sha256) throw new Error('Rollback checksum mismatch.');
  }
  const digest = createHash('sha256').update(await readFile(manifestPath)).digest('hex');
  return { integrityVerified: true, files: names.size, component: manifest.component, baselineVerified: manifest.baselineVerified,
    rollbackReady: manifest.baselineVerified, manifestSha256: digest, deploymentApproved: false, productionModified: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--manifest') throw new Error('Use --manifest <private-review-manifest>. No apply/deploy selector exists.');
    console.log(JSON.stringify(await verifyRollbackPackage(process.argv[3])));
  } catch (error) { console.error(error instanceof Error ? error.message : 'Rollback verification refused.'); process.exitCode = 1; }
}
