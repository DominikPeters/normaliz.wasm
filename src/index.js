/**
 * normaliz.wasm - WebAssembly build of Normaliz
 *
 * Usage:
 *   import createNormaliz from 'normaliz.wasm';
 *   const normaliz = await createNormaliz();
 *   normaliz.FS.writeFile('input.in', inputData);
 *   normaliz.callMain(['input']);
 *   const output = normaliz.FS.readFile('input.out', { encoding: 'utf8' });
 */
export { default } from '../dist/normaliz.js';
