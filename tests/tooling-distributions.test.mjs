import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDistributions } from '../scripts/check-distributions.mjs';
import { mock, test } from 'node:test';

function runChecker({ filename = 'package.tgz', output, result = { status: 0 } } = {}) {
    const previousExitCode = process.exitCode;
    const calls = [];
    mock.method(childProcess, 'execFileSync', (_executable, args, options) => {
        assert.equal(options.cwd.endsWith('/typescript'), true);
        const destination = args[args.indexOf('--pack-destination') + 1];
        if (filename === 'package.tgz') writeFileSync(join(destination, filename), 'exact archive bytes');
        return output ?? JSON.stringify([{ filename }]);
    });
    mock.method(childProcess, 'spawnSync', (executable, args, options) => {
        calls.push({ executable, args, options });
        return result;
    });
    syncBuiltinESMExports();
    try {
        checkDistributions();
        return { exitCode: process.exitCode, calls };
    } finally {
        mock.restoreAll();
        syncBuiltinESMExports();
        process.exitCode = previousExitCode;
    }
}

test('passes exact packed bytes to the Python checker over stdin', () => {
    const { exitCode, calls } = runChecker();
    assert.equal(exitCode, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, ['python/scripts/check_distributions.py']);
    assert.equal(calls[0].executable.endsWith('/python/.venv/bin/python'), true);
    assert.equal(calls[0].options.input.toString(), 'exact archive bytes');
    assert.deepEqual(calls[0].options.stdio, ['pipe', 'inherit', 'inherit']);
});

for (const filename of [12, '../outside.tgz', 'package.zip']) {
    test(`rejects invalid npm pack filename ${String(filename)}`, () => {
        assert.throws(() => runChecker({ filename }), /single archive filename/);
    });
}

test('rejects invalid npm pack JSON', () => {
    assert.throws(() => runChecker({ output: 'not JSON' }), SyntaxError);
});

test('propagates Python process failures and absent exit statuses', () => {
    assert.equal((runChecker({ result: { status: 7 } })).exitCode, 7);
    assert.equal((runChecker({ result: { status: null } })).exitCode, 1);
    const failure = new Error('Python could not start');
    assert.throws(() => runChecker({ result: { error: failure } }), error => error === failure);
});


test('direct CLI checks real packed artifacts and mirrored fixtures', () => {
    const script = fileURLToPath(new URL('../scripts/check-distributions.mjs', import.meta.url));
    const output = childProcess.execFileSync(process.execPath, [script], { encoding: 'utf8' });
    assert.match(output, /Distribution boundaries and 13 shared wire fixtures passed/);
});

test('import works without a process entry path', () => {
    const script = new URL('../scripts/check-distributions.mjs', import.meta.url).href;
    childProcess.execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(script)})`]);
});
