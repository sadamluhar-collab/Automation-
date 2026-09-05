import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeChannel} from '../src/channels/channel.analyzer.js';

test('channel analyzer uses real supplied video data and de-duplicates topics',()=>{
  const result=analyzeChannel({id:'UC1',title:'Cooking'},[
    {id:'1',title:'Easy Pasta Recipe',views:1000,likes:100,comments:10,published_at:'2026-01-01',duration_seconds:30},
    {id:'2',title:'Easy Pasta Recipe',views:3000,likes:200,comments:20,published_at:'2026-01-02',duration_seconds:35},
    {id:'3',title:'Crispy Pizza Recipe',views:2000,likes:150,comments:15,published_at:'2026-01-03',duration_seconds:40}
  ]);
  assert.equal(result.channel_id,'UC1');
  assert.equal(result.sample_size,3);
  assert.equal(result.average_views,2000);
  assert.equal(result.top_videos[0].id,'2');
  assert.equal(result.top_videos[0].views,3000);
  assert.equal(result.top_videos.length,3);
  assert.equal(result.content_rules.use_real_channel_data,true);
  assert.ok(result.title_keywords.some(x=>x.word==='pasta'));
});
