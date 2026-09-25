import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const distDir = join(root, 'dist');
const SENTINEL_KEY = 'test-key-should-not-ship';
const FORBIDDEN = [SENTINEL_KEY, 'GEMINI_API_KEY'];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

describe('production bundle', () => {
  it('does not contain the Gemini API key or its variable name', () => {
    execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
      cwd: root,
      env: { ...process.env, GEMINI_API_KEY: SENTINEL_KEY },
      stdio: 'pipe',
    });

    const files = filesUnder(distDir);
    // An empty build would pass the leak check without proving anything.
    expect(files.filter((file) => file.endsWith('.js')).length).toBeGreaterThan(0);

    const leaks = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN.filter((needle) => text.includes(needle)).map(
        (needle) => `${relative(root, file)} contains ${needle}`,
      );
    });
    expect(leaks).toEqual([]);
  }, 120_000);
});
