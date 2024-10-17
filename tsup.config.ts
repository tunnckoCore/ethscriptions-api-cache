import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2023',
  entry: ['src/index.ts', 'src/server.ts'],
  splitting: false,
  clean: true,
  banner: { js: '// SPDX-License-Identifier: MPL-2.0' },
  cjsInterop: false,
  dts: true,
  format: 'esm',
});
