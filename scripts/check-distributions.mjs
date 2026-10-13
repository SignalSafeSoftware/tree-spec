import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'tree-spec-distributions-'));
try {
    const output = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' });
    const [packed] = JSON.parse(output);
    const result = spawnSync(`${root}python/.venv/bin/python`, ['python/scripts/check_distributions.py', join(temporary, packed.filename)], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
