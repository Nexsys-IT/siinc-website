import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');

describe('RootLayout source', () => {
  it('does not use protocol-relative URL attributes', () => {
    expect(layoutSource).not.toMatch(/\b(?:href|src)=["']\/\//);
  });
});
