import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export async function publish(_pluginConfig, context) {
  const child = spawn('npm', ['publish', '--provenance'], {
    cwd: context.cwd,
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`npm publish failed with exit code ${code}`));
    });
  });

  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  return {
    name: 'npm package',
    url: `https://www.npmjs.com/package/${pkg.name}/v/${context.nextRelease.version}`,
  };
}
