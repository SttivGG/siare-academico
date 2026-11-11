import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const settings = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const project = /^COMPOSE_PROJECT_NAME=(.+)$/m.exec(settings)?.[1].trim();
if (!project || !/^[a-z0-9][a-z0-9_-]+$/.test(project)) throw Error('Invalid SIARE project');
export function compose(...args) {
  execFileSync('docker', ['compose', '--project-name', project, '--project-directory', root,
    '--env-file', fileURLToPath(new URL('../.env', import.meta.url)),
    '--file', fileURLToPath(new URL('../compose.datos.yml', import.meta.url)),
    '--file', fileURLToPath(new URL('../compose.apps.yml', import.meta.url)), ...args],
  { cwd: root, stdio: 'inherit', timeout: 960_000 });
}
