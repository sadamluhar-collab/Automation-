import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRunIdempotencyKey} from '../src/pipeline/direct-run.service.js';

test('direct Short idempotency key is stable for the same project/prompt/day',()=>{
  const a=makeRunIdempotencyKey({projectId:'project-a',prompt:'Create a unique 60-second YouTube Short'});
  const b=makeRunIdempotencyKey({projectId:'project-a',prompt:'Create a unique 60-second YouTube Short'});
  assert.equal(a,b);
  assert.match(a,/^short:project-a:[a-f0-9]{32}$/);
});

test('explicit idempotency key is preserved',()=>{
  assert.equal(makeRunIdempotencyKey({projectId:'project-a',prompt:'x',idempotencyKey:'request-123'}),'request-123');
});

test('different project or prompt cannot share an implicit key',()=>{
  const base=makeRunIdempotencyKey({projectId:'project-a',prompt:'Create a unique 60-second YouTube Short'});
  const otherProject=makeRunIdempotencyKey({projectId:'project-b',prompt:'Create a unique 60-second YouTube Short'});
  const otherPrompt=makeRunIdempotencyKey({projectId:'project-a',prompt:'Create a different Short'});
  assert.notEqual(base,otherProject);
  assert.notEqual(base,otherPrompt);
});
