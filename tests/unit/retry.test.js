import test from 'node:test';import assert from 'node:assert/strict';import {backoff} from '../../src/utils/retry.js';test('backoff grows',()=>assert.ok(backoff(3,1)>=4));
