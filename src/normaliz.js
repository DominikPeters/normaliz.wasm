/**
 * normaliz.wasm — JavaScript wrapper for Normaliz WebAssembly module.
 *
 * Usage:
 *   import { Normaliz } from 'normaliz.wasm';
 *   const nmz = await Normaliz.create();
 *   const result = nmz.run('amb_space 2\ncone 2\n1 3\n2 1\n');
 *   console.log(result.output);    // main .out file contents
 *   console.log(result.console);   // verbose console log
 *   console.log(result.files);     // { 'gen': '...', 'ext': '...', ... }
 */

import createNormaliz from '../dist/normaliz.js';

const OUTPUT_EXTENSIONS = [
    'out', 'gen', 'egn', 'esp', 'ext', 'typ',
    'lat', 'cst', 'inv', 'tri', 'ht1', 'dec',
    'mod', 'msp', 'fac', 'inc', 'tgn',
];

export class Normaliz {
    /**
     * Create a new Normaliz instance.
     * Each instance holds its own wasm module with a virtual filesystem.
     *
     * @param {Object} [opts]
     * @param {Function} [opts.loadModule] - Custom module loader (overrides default)
     * @param {Function} [opts.onStdout] - Called with each line of stdout during computation
     * @param {Function} [opts.onStderr] - Called with each line of stderr during computation
     * @returns {Promise<Normaliz>}
     */
    static async create(opts = {}) {
        const instance = new Normaliz();
        const loader = opts.loadModule || createNormaliz;
        instance._onStdout = opts.onStdout || null;
        instance._onStderr = opts.onStderr || null;
        instance._module = await loader({
            print: (text) => {
                instance._stdoutBuf.push(text);
                if (instance._onStdout) instance._onStdout(text);
            },
            printErr: (text) => {
                instance._stderrBuf.push(text);
                if (instance._onStderr) instance._onStderr(text);
            },
        });
        return instance;
    }

    constructor() {
        this._module = null;
        this._stdoutBuf = [];
        this._stderrBuf = [];
        this._onStdout = null;
        this._onStderr = null;
        this._runCounter = 0;
    }

    /**
     * Run a Normaliz computation.
     *
     * @param {string} input - Contents of the .in file
     * @param {Object} [opts]
     * @param {string[]} [opts.flags] - Extra CLI flags, e.g. ['--verbose', '-a']
     * @returns {{ output: string, console: string, stderr: string, files: Object<string,string>, exitCode: number }}
     */
    run(input, opts = {}) {
        const m = this._module;
        const flags = opts.flags || [];
        const name = `_run${this._runCounter++}`;
        const inFile = `${name}.in`;

        // Clear buffers
        this._stdoutBuf = [];
        this._stderrBuf = [];

        // Write input
        m.FS.writeFile(inFile, input);

        // Run normaliz
        let exitCode = 0;
        try {
            exitCode = m.callMain([...flags, name]);
        } catch (e) {
            // callMain may throw on non-zero exit
            exitCode = 1;
        }

        // Collect output files
        const files = {};
        for (const ext of OUTPUT_EXTENSIONS) {
            const fname = `${name}.${ext}`;
            try {
                files[ext] = m.FS.readFile(fname, { encoding: 'utf8' });
            } catch (e) {
                // File doesn't exist — computation didn't produce it
            }
        }

        // Read main output
        const output = files.out || '';

        // Clean up virtual filesystem
        try { m.FS.unlink(inFile); } catch (e) {}
        for (const ext of OUTPUT_EXTENSIONS) {
            try { m.FS.unlink(`${name}.${ext}`); } catch (e) {}
        }

        return {
            output,
            console: this._stdoutBuf.join('\n'),
            stderr: this._stderrBuf.join('\n'),
            files,
            exitCode,
        };
    }

    /**
     * List available example file names.
     * (Requires examples to be loaded via loadExamples first.)
     * @returns {string[]}
     */
    listExamples() {
        try {
            return this._module.FS.readdir('/examples')
                .filter(f => f.endsWith('.in'))
                .sort();
        } catch (e) {
            return [];
        }
    }

    /**
     * Load example files into the virtual filesystem.
     * @param {Object<string,string>} examples - Map of filename to contents
     */
    loadExamples(examples) {
        const m = this._module;
        try { m.FS.mkdir('/examples'); } catch (e) {}
        for (const [name, content] of Object.entries(examples)) {
            m.FS.writeFile(`/examples/${name}`, content);
        }
    }

    /**
     * Read an example file's contents.
     * @param {string} name - Filename (e.g. '2cone.in')
     * @returns {string}
     */
    readExample(name) {
        return this._module.FS.readFile(`/examples/${name}`, { encoding: 'utf8' });
    }
}
