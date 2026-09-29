# Third-party notices

`bun run generate` bundles the plugin's entry-point scripts (`plugins/factory/scripts/session-start.ts`,
`checkups.ts`, `doctest.ts`) into self-contained, minified files in `plugins/factory/dist/` (ADR 0020). Those
bundles, not the readable sources, are what the plugin distributes and runs.

Minifying inlines third-party source without its license header or the package's `LICENSE` file. This file carries
the notice forward, so a copy of `plugins/factory/` (the distributed unit) keeps it. It is hand-maintained: update
it when a bundled entry point starts or stops depending on a package whose license requires attribution (typically
MIT, BSD or Apache-2.0).

## Zod

Bundled into `dist/checkups.js` and `dist/session-start.js` (both import `zod`; `dist/doctest.js` does not).

```
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: `node_modules/zod/LICENSE` (package `zod`, declared `"license": "MIT"` in `node_modules/zod/package.json`).
