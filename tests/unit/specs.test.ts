// Runs the shared specs (tests/specs) under Node's test runner.
import { test } from 'node:test';
import { specs } from '../specs/harness.ts';
import '../specs/index.ts';

for (const s of specs) test(`${s.group} › ${s.name}`, () => s.run());
