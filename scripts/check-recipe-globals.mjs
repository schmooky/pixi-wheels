#!/usr/bin/env node
/**
 * Guard: the two recipe runtimes must share one global surface.
 *
 * `RecipeRunner` and `Studio` both evaluate recipe-shaped code. A hand-written
 * parameter list in either would drift from the other, and recipe bodies are
 * `@ts-nocheck` strings that no compiler reads, so the drift would surface as
 * `Can't find variable: ...` at run time. Both call `runRecipeSource` from
 * `lib/recipeGlobals.ts`; this fails the build if one goes back to its own list.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const RUNTIMES = [
  'apps/site/src/components/RecipeRunner.tsx',
  'apps/site/src/components/Studio.tsx',
];

const GLOBALS_MODULE = 'apps/site/src/lib/recipeGlobals.ts';

const problems = [];

for (const rel of RUNTIMES) {
  const src = await readFile(resolve(ROOT, rel), 'utf8');

  // Match a CALL, not the substring: `runRecipeSourceX(...)` contains
  // `runRecipeSource` and would sail through an includes() check.
  if (!/\brunRecipeSource\s*[<(]/.test(src)) {
    problems.push(
      `${rel}: does not use runRecipeSource(). Every recipe runtime must go ` +
      `through ${GLOBALS_MODULE} so the three cannot drift.`,
    );
    continue;
  }

  // A `new AsyncFunction(` with more than the source argument means someone
  // re-introduced a hand-written parameter list.
  const handRolled = /new AsyncFunction\(\s*['"]/.exec(src);
  if (handRolled) {
    problems.push(
      `${rel}: builds its own AsyncFunction parameter list (found ` +
      `\`${handRolled[0].trim()}\`). Add the value to ${GLOBALS_MODULE} instead.`,
    );
  }
}


if (problems.length > 0) {
  console.error('check-recipe-globals failed:\n');
  for (const p of problems) console.error(`  - ${p}\n`);
  process.exit(1);
}

console.log(`check-recipe-globals: ${RUNTIMES.length} runtimes share one global surface.`);
