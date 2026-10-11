import test from "node:test";
import assert from "node:assert/strict";
import { mergeRunHistory } from "../lib/run-history.ts";
import { makeChatTranscript } from "../lib/chat-transcript.ts";

test("new session launches retain earlier Supabase history", () => {
  const stored = [{id:1000,title:"old",status:"done"}, {id:2000,title:"recent",status:"done"}];
  const local = [{id:3000,title:"new",status:"running"}];
  assert.deepEqual(mergeRunHistory(local,stored).map(x=>x.title), ["new","recent","old"]);
  assert.equal(mergeRunHistory([],stored).length,2);
  assert.deepEqual(mergeRunHistory(local,stored,2).map(x=>x.title), ["new","recent"]);
});

test("local event wins on duplicate identifier and invalid identifiers are dropped", () => {
  const local = [{id:3000,title:"local updated"},{id:NaN,title:"bad"}];
  const stored = [{id:3000,title:"older persisted"},{id:2000,title:"history"}];
  assert.deepEqual(mergeRunHistory(local,stored).map(x=>x.title), ["local updated","history"]);
});

test("offline transcript exports messages and citations but never embeds images", () => {
  const content = makeChatTranscript([
    {role:"user",content:"Зроби код"},
    {role:"assistant",content:"Результат",meta:"Gemini · відповідь",imageUrl:"data:image/png;base64,SECRET_IMAGE",
      sources:[{title:"Docs",url:"https://example.org/docs"},{title:"Blocked",url:"javascript:alert(1)"}]},
  ]);
  assert.match(content,/ARTSS AI/);
  assert.match(content,/Зроби код/);
  assert.match(content,/Результат/);
  assert.match(content,/https:\/\/example.org\/docs/);
  assert.doesNotMatch(content,/SECRET_IMAGE|javascript:alert/);
});

test("empty conversation creates only header, never synthetic tasks", () => {
  const content = makeChatTranscript([]);
  assert.match(content,/ARTSS AI/);
  assert.doesNotMatch(content,/## Користувач/);
});
