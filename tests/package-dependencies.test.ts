import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
    name?: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

const declaredRuntime = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
]);

const forbidden = ['react-bootstrap', 'bootstrap'];

function listFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

function packageNameFromSpecifier(specifier: string): string | null {
    if (specifier.startsWith('.') || specifier.startsWith('node:')) {
        return null;
    }
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
    }
    return specifier.split('/')[0] ?? null;
}

function externalImports(text: string): string[] {
    const imports: string[] = [];
    const patterns = [
        /\bfrom\s+['"]([^'"]+)['"]/g,
        /\bimport\s+['"]([^'"]+)['"]/g,
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            const name = packageNameFromSpecifier(match[1] ?? '');
            if (name) {
                imports.push(name);
            }
        }
    }
    return imports;
}

describe('package dependency declarations', () => {
    it('does not declare forbidden Bootstrap runtime dependencies', () => {
        const names = [
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.peerDependencies ?? {}),
        ];
        for (const name of names) {
            expect(forbidden).not.toContain(name);
        }
    });

    it('declares every external package imported by dist JS', () => {
        const distDir = fileURLToPath(new URL('../dist', import.meta.url));
        const found = new Set<string>();
        for (const file of listFiles(distDir)) {
            if (!file.endsWith('.js')) {
                continue;
            }
            for (const imp of externalImports(readFileSync(file, 'utf8'))) {
                found.add(imp);
            }
        }

        for (const imp of found) {
            if (imp === pkg.name) {
                continue;
            }
            expect(
                declaredRuntime.has(imp),
                `${pkg.name ?? 'package'} dist imports ${imp} but it is not in dependencies or peerDependencies`,
            ).toBe(true);
        }
    });
});
