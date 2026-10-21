import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = realpathSync(join(dirname(process.execPath), 'npm'));
const temporary = mkdtempSync(join(tmpdir(), 'tree-spec-distributions-'));
try {
    const output = execFileSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: join(root, 'typescript'), encoding: 'utf8' });
    const [packed] = JSON.parse(output);
    if (typeof packed.filename !== 'string' || basename(packed.filename) !== packed.filename || !packed.filename.endsWith('.tgz')) {
        throw new Error('npm pack must return a single archive filename');
    }
    const archive = readFileSync(join(temporary, packed.filename));
    const result = spawnSync(`${root}python/.venv/bin/python`, ['python/scripts/check_distributions.py'], { cwd: root, input: archive, stdio: ['pipe', 'inherit', 'inherit'] });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
