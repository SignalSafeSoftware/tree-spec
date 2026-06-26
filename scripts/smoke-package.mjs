import { runSmokePackage } from './smoke-package-lib.mjs';

runSmokePackage({
    runtimeChecks: [
        {
            subpath: '.',
            exports: ['TREESPEC_WIRE_VERSION', 'lintTreeSpecWire', 'compileTreeSpec'],
        },
    ],
    typecheckSubpaths: ['.'],
});
