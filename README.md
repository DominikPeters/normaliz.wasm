# normaliz.wasm

WebAssembly build of [Normaliz](https://github.com/Normaliz/Normaliz), usable from Node.js and the browser.

[Normaliz](https://www.normaliz.uni-osnabrueck.de/) is a tool for computations in affine monoids, vector configurations, lattice polytopes, and rational cones. It supports Hilbert bases, Hilbert series, triangulations, volumes, and much more.

**[Try it in your browser](https://DominikPeters.github.io/normaliz.wasm)**

## Installation

```bash
npm install normaliz.wasm
```

## Usage (Node.js)

```js
import { Normaliz } from 'normaliz.wasm';

const nmz = await Normaliz.create();
const result = nmz.run(`amb_space 2
cone 2
1 3
2 1
`);

console.log(result.output);   // main .out file contents
console.log(result.files);    // { out: '...', gen: '...', ext: '...', ... }
console.log(result.console);  // verbose log
console.log(result.exitCode); // 0 on success
```

### Options

```js
// With CLI flags
const result = nmz.run(input, { flags: ['--verbose', '-a'] });

// Stream console output in real time
const nmz = await Normaliz.create({
  onStdout: (line) => process.stdout.write(line + '\n'),
});
```

### Low-level API

You can also use the Emscripten module directly:

```js
import createNormaliz from 'normaliz.wasm/dist/normaliz.js';

const m = await createNormaliz();
m.FS.writeFile('test.in', 'amb_space 2\ncone 2\n1 3\n2 1\n');
m.callMain(['test']);
const output = m.FS.readFile('test.out', { encoding: 'utf8' });
```

## Browser usage

In the browser, run Normaliz in a Web Worker to avoid blocking the main thread. See the [web demo source](web/) for a complete example.

## Cross-compiled dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [GMP](https://gmplib.org/) | 6.3.0 | Arbitrary-precision arithmetic |
| [MPFR](https://www.mpfr.org/) | 4.2.2 | Multi-precision floats |
| [FLINT](https://flintlib.org/) | 3.3.1 | Polynomial arithmetic |
| [nauty](https://pallini.di.uniroma1.it/) | 2.9.1 | Automorphism groups |
| [hash-library](https://github.com/stbrumme/hash-library) | 8 | SHA-256 hashing |

## Building from source

Prerequisites: [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) activated.

```bash
source /path/to/emsdk/emsdk_env.sh
npm run build
```

This cross-compiles all dependencies and Normaliz to WebAssembly. Output goes to `dist/`.

## License

GPL-3.0-or-later (same as Normaliz)
