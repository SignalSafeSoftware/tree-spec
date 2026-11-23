import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { mock, test } from 'node:test';

let invocation = 0;

async function runChecker({ filename = 'package.tgz', output, result = { status: 0 } } = {}) {
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
        const checker = await import('../scripts/check-distributions.mjs');
        if (invocation++ > 0) checker.checkDistributions();
        return { exitCode: process.exitCode, calls };
    } finally {
        mock.restoreAll();
        syncBuiltinESMExports();
        process.exitCode = previousExitCode;
    }
}

test('passes exact packed bytes to the Python checker over stdin', async () => {
    const { exitCode, calls } = await runChecker();
    assert.equal(exitCode, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, ['python/scripts/check_distributions.py']);
    assert.equal(calls[0].executable.endsWith('/python/.venv/bin/python'), true);
    assert.equal(calls[0].options.input.toString(), 'exact archive bytes');
    assert.deepEqual(calls[0].options.stdio, ['pipe', 'inherit', 'inherit']);
});

test('rejects invalid npm pack metadata before starting Python', async () => {
    for (const filename of [12, '../outside.tgz', 'package.zip']) {
        await assert.rejects(runChecker({ filename }), /single archive filename/);
    }
    await assert.rejects(runChecker({ output: 'not JSON' }), SyntaxError);
});

test('propagates Python process failures and absent exit statuses', async () => {
    assert.equal((await runChecker({ result: { status: 7 } })).exitCode, 7);
    assert.equal((await runChecker({ result: { status: null } })).exitCode, 1);
    const failure = new Error('Python could not start');
    await assert.rejects(runChecker({ result: { error: failure } }), error => error === failure);
});
