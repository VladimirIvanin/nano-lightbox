import { readFile } from 'node:fs/promises';

export function checkRelease(version, tag, prerelease) {
  if (tag !== `v${version}`) throw new Error(`Expected release tag v${version}, received ${tag}`);
  if (version.split('+')[0].includes('-') && !prerelease) throw new Error('Mark this version as a GitHub pre-release');
  return prerelease ? 'next' : 'latest';
}

if (process.env.RELEASE_TAG) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  console.log(`npm dist-tag: ${checkRelease(version, process.env.RELEASE_TAG, process.env.PRERELEASE === 'true')}`);
} else if (process.argv[1]?.replaceAll('\\', '/').endsWith('/check-release.js')) {
  throw new Error('RELEASE_TAG is required');
}
