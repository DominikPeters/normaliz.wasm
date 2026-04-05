/**
 * Web Worker that runs Normaliz computations off the main thread.
 *
 * Protocol:
 *   Main → Worker:  { type: 'run', input: string, flags: string[] }
 *   Worker → Main:  { type: 'stdout', line: string }
 *   Worker → Main:  { type: 'stderr', line: string }
 *   Worker → Main:  { type: 'result', output: string, files: {}, exitCode: number }
 *   Worker → Main:  { type: 'ready' }
 *   Worker → Main:  { type: 'error', message: string }
 */

import createNormaliz from './normaliz.js';

const OUTPUT_EXTENSIONS = [
    'out', 'gen', 'egn', 'esp', 'ext', 'typ',
    'lat', 'cst', 'inv', 'tri', 'ht1', 'dec',
    'mod', 'msp', 'fac', 'inc', 'tgn',
];

let module = null;
let runCounter = 0;

function isRuntimeNoise(line) {
    return typeof line === 'string'
        && line.includes('program exited (with status:')
        && line.includes('keepRuntimeAlive() is set');
}

async function init() {
    module = await createNormaliz({
        print: (line) => {
            if (!isRuntimeNoise(line)) postMessage({ type: 'stdout', line });
        },
        printErr: (line) => {
            if (!isRuntimeNoise(line)) postMessage({ type: 'stderr', line });
        },
    });
    postMessage({ type: 'ready' });
}

function run(input, flags) {
    const name = `_run${runCounter++}`;
    const inFile = `${name}.in`;

    module.FS.writeFile(inFile, input);

    let exitCode = 0;
    try {
        exitCode = module.callMain([...flags, name]);
    } catch (e) {
        exitCode = 1;
    }

    // Collect output files
    const files = {};
    for (const ext of OUTPUT_EXTENSIONS) {
        const fname = `${name}.${ext}`;
        try {
            files[ext] = module.FS.readFile(fname, { encoding: 'utf8' });
        } catch (e) {}
    }

    const output = files.out || '';

    // Clean up
    try { module.FS.unlink(inFile); } catch (e) {}
    for (const ext of OUTPUT_EXTENSIONS) {
        try { module.FS.unlink(`${name}.${ext}`); } catch (e) {}
    }

    postMessage({ type: 'result', output, files, exitCode });
}

self.onmessage = (e) => {
    const { type, input, flags } = e.data;
    if (type === 'run') {
        try {
            run(input, flags || []);
        } catch (err) {
            postMessage({ type: 'error', message: err.message });
        }
    }
};

init().catch(err => {
    postMessage({ type: 'error', message: 'Failed to initialize: ' + err.message });
});
