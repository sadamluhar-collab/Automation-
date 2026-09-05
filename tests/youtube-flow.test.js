import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,verifyState,authorizationUrl,refreshAccessToken} from '../src/auth/youtube.oauth.js';

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.WORKER_SECRET ||= 'test-worker-secret';
process.env.YOUTUBE_CLIENT_ID ||= 'test-client';
process.env.YOUTUBE_CLIENT_SECRET ||= 'test-secret';
process.env.YOUTUBE_REDIRECT_URI ||= 'https://example.com/api/youtube/callback';

 test('YouTube OAuth state is signed and rejects tampering',()=>{
  const state=createState('00000000-0000-0000-0000-000000000001');
  const verified=verifyState(state);
  assert.equal(verified.sub,'00000000-0000-0000-0000-000000000001');
  assert.throws(()=>verifyState(`${state}x`));
});

test('YouTube authorization URL requires the configured redirect',()=>{
  const url=authorizationUrl('state-value');
  const parsed=new URL(url);
  assert.equal(parsed.origin,'https://accounts.google.com');
  assert.equal(parsed.searchParams.get('redirect_uri'),process.env.YOUTUBE_REDIRECT_URI);
  assert.equal(parsed.searchParams.get('access_type'),'offline');
});

test('YouTube refresh helper requires a refresh token',async()=>{
  await assert.rejects(()=>refreshAccessToken(''),/Missing YouTube refresh token/);
});
