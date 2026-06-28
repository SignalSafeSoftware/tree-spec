import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {{
 *   runtimeChecks?: Array<{ subpath?: string; exports: string[] }>;
 *   typecheckSubpaths?: string[];
 * }} config
 */
function fixNodeEsmRelativeImports(targetDir) {
    if (!fs.existsSync(targetDir)) {
        return;
    }

    const explicitExtensionRe = /\.(?:[cm]?js|json|css|svg|png|jpe?g|gif|webp|map)$/i;
    let changedFiles = 0;

    const listFiles = (dir) => {
        const files = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...listFiles(fullPath));
            } else if (fullPath.endsWith('.js') || fullPath.endsWith('.d.ts')) {
                files.push(fullPath);
            }
        }
        return files;
    };

    const resolveRuntimeSpecifier = (filePath, specifier) => {
        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
            return specifier;
        }
        if (explicitExtensionRe.test(specifier)) {
            return specifier;
        }
        const baseDir = path.dirname(filePath);
        const fileCandidate = path.join(baseDir, `${specifier}.js`);
        if (fs.existsSync(fileCandidate)) {
            return `${specifier}.js`;
        }
        const indexCandidate = path.join(baseDir, specifier, 'index.js');
        if (fs.existsSync(indexCandidate)) {
            return `${specifier}/index.js`;
        }
        return specifier;
    };

    const rewriteSpecifiers = (filePath, content) => {
        const replacers = [
            /\bfrom\s+(['"])(\.{1,2}\/[^'"]+)\1/g,
            /\bimport\s+(['"])(\.{1,2}\/[^'"]+)\1/g,
        ];
        let updated = content;
        for (const pattern of replacers) {
            updated = updated.replace(pattern, (full, _quote, specifier) => {
                const nextSpecifier = resolveRuntimeSpecifier(filePath, specifier);
                return full.replace(specifier, nextSpecifier);
            });
        }
        return updated;
    };

    for (const filePath of listFiles(targetDir)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const updated = rewriteSpecifiers(filePath, content);
        if (updated !== content) {
            fs.writeFileSync(filePath, updated);
            changedFiles += 1;
        }
    }

    if (changedFiles > 0) {
        console.log(`fix-node-esm-relative-imports: updated ${changedFiles} file(s) in ${targetDir}`);
    }
}

function runStandaloneBuild(root, npmCmd) {
    const buildConfigPath = path.join(root, 'tsconfig.build.json');
    if (!fs.existsSync(buildConfigPath)) {
        execFileSync(npmCmd, ['run', 'build'], { cwd: root, stdio: 'inherit' });
        return;
    }

    const smokeConfigPath = path.join(root, '.smoke-tsconfig.build.json');
    fs.writeFileSync(
        smokeConfigPath,
        `${JSON.stringify(
            {
                extends: './tsconfig.build.json',
                compilerOptions: {
                    paths: {},
                },
            },
            null,
            2,
        )}\n`,
    );

    try {
        execFileSync(npmCmd, ['exec', '--', 'tsc', '-p', smokeConfigPath], {
            cwd: root,
            stdio: 'inherit',
        });

        fixNodeEsmRelativeImports(path.join(root, 'dist'));

        const fixScript = path.join(root, 'scripts/fix-node-esm-relative-imports.ts');
        if (fs.existsSync(fixScript)) {
            execFileSync(npmCmd, ['exec', '--', 'tsx', fixScript, 'dist'], {
                cwd: root,
                stdio: 'inherit',
            });
        }
    } finally {
        fs.unlinkSync(smokeConfigPath);
    }
}

export function runSmokePackage(config) {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    const run = (args, opts = {}) => {
        execFileSync(npmCmd, args, {
            cwd: opts.cwd || root,
            stdio: 'inherit',
            env: { ...process.env, ...opts.env },
        });
    };

    runStandaloneBuild(root, npmCmd);

    const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-pack-'));
    const packOutput = execFileSync(npmCmd, ['pack', '--ignore-scripts', '--pack-destination', packDir], {
        cwd: root,
        encoding: 'utf8',
    });
    const tgzName = packOutput
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .pop();
    if (!tgzName) {
        throw new Error('npm pack did not return a tarball name');
    }
    const tgzPath = path.join(packDir, tgzName);

    verifyTarballContents(tgzPath, pkg);

    const consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-consumer-'));

    try {
        const dependencies = {
            [pkg.name]: `file:${tgzPath}`,
            ...getRegistryDeps(pkg),
            ...getPeerInstallVersions(pkg),
        };

        const devDependencies = {};
        if (config.typecheckSubpaths?.length) {
            devDependencies.typescript = pkg.devDependencies?.typescript || '^5.4.2';
            if (pkg.peerDependencies?.react) {
                devDependencies['@types/react'] =
                    pkg.devDependencies?.['@types/react'] || '^18.2.66';
                devDependencies['@types/react-dom'] =
                    pkg.devDependencies?.['@types/react-dom'] || '^18.2.22';
            }
        }

        fs.writeFileSync(
            path.join(consumerDir, 'package.json'),
            `${JSON.stringify(
                {
                    name: 'smoke-consumer',
                    private: true,
                    type: 'module',
                    dependencies,
                    devDependencies,
                },
                null,
                2,
            )}\n`,
        );

        run(['install', '--no-fund', '--no-audit'], { cwd: consumerDir });

        if (config.runtimeChecks?.length) {
            runRuntimeChecks(consumerDir, pkg.name, config.runtimeChecks);
        }

        if (config.typecheckSubpaths?.length) {
            runTypeChecks(consumerDir, pkg.name, config.typecheckSubpaths);
        }

        console.log(`smoke-package: OK (${pkg.name}@${pkg.version})`);
    } finally {
        fs.rmSync(packDir, { recursive: true, force: true });
        fs.rmSync(consumerDir, { recursive: true, force: true });
    }
}

function getRegistryDeps(pkg) {
    const out = {};
    for (const [name, range] of Object.entries(pkg.dependencies || {})) {
        if (name.startsWith('@signalsafe/')) {
            out[name] = range;
        }
    }
    return out;
}

function getPeerInstallVersions(pkg) {
    const out = {};
    for (const name of Object.keys(pkg.peerDependencies || {})) {
        out[name] = pkg.devDependencies?.[name] || pkg.peerDependencies[name];
    }
    return out;
}

function resolveImportSpecifier(packageName, subpath = '.') {
    if (!subpath || subpath === '.') {
        return packageName;
    }
    return `${packageName}/${subpath.replace(/^\.\//, '')}`;
}

function runRuntimeChecks(consumerDir, packageName, runtimeChecks) {
    const lines = ['import assert from "node:assert";', ''];
    runtimeChecks.forEach((check, index) => {
        const spec = resolveImportSpecifier(packageName, check.subpath);
        const alias = `mod${index}`;
        lines.push(`const ${alias} = await import(${JSON.stringify(spec)});`);
        for (const exportName of check.exports) {
            lines.push(
                `assert.ok(typeof ${alias}.${exportName} !== "undefined", ${JSON.stringify(`missing export ${exportName} from ${spec}`)});`,
            );
        }
        lines.push('');
    });
    lines.push('console.log("runtime import checks OK");');

    const verifyPath = path.join(consumerDir, 'verify-runtime.mjs');
    fs.writeFileSync(verifyPath, lines.join('\n'));
    execFileSync(process.execPath, [verifyPath], { cwd: consumerDir, stdio: 'inherit' });
}

function runTypeChecks(consumerDir, packageName, subpaths) {
    const importLines = subpaths.map((subpath, index) => {
        const spec = resolveImportSpecifier(packageName, subpath);
        return `import type * as Smoke${index} from ${JSON.stringify(spec)};`;
    });

    fs.writeFileSync(
        path.join(consumerDir, 'consumer.ts'),
        `${importLines.join('\n')}\nexport {};\n`,
    );
    fs.writeFileSync(
        path.join(consumerDir, 'tsconfig.json'),
        `${JSON.stringify(
            {
                compilerOptions: {
                    module: 'NodeNext',
                    moduleResolution: 'NodeNext',
                    strict: true,
                    noEmit: true,
                    skipLibCheck: true,
                },
                include: ['consumer.ts'],
            },
            null,
            2,
        )}\n`,
    );

    execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], {
        cwd: consumerDir,
        stdio: 'inherit',
    });
    console.log('type declaration checks OK');
}

function verifyTarballContents(tgzPath, pkg) {
    const listing = execFileSync('tar', ['-tf', tgzPath], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);

    const required = new Set([
        'package/package.json',
        'package/README.md',
        'package/LICENSE',
    ]);

    const addPackagePath = (relativePath) => {
        if (!relativePath) {
            return;
        }
        required.add(`package/${relativePath.replace(/^\.\//, '')}`);
    };

    addPackagePath(pkg.main);
    addPackagePath(pkg.types);

    for (const exportEntry of Object.values(pkg.exports || {})) {
        if (typeof exportEntry !== 'object' || exportEntry === null) {
            continue;
        }
        addPackagePath(exportEntry.import);
        addPackagePath(exportEntry.types);
    }

    for (const requiredPath of required) {
        if (!listing.includes(requiredPath)) {
            throw new Error(`smoke-package: tarball missing required path ${requiredPath}`);
        }
    }

    const forbiddenPatterns = [
        /^package\/tests\//,
        /^package\/coverage\//,
        /^package\/node_modules\//,
        /^package\/\.env/,
        /^package\/src\//,
        /^package\/scripts\//,
        /^package\/\.github\//,
        /README\.standalone\.md$/,
        /^package\/prompts\//,
        /\/PROMPT_LOG(\.|$)/,
    ];

    for (const entry of listing) {
        if (forbiddenPatterns.some((pattern) => pattern.test(entry))) {
            throw new Error(`smoke-package: tarball contains unwanted path ${entry}`);
        }
    }

    console.log(`tarball contents audit OK (${listing.length} paths)`);
}
