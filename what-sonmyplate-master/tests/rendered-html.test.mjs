import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the hand-drawn horizontal journal includes its primary flows", async () => {
  const source = await readFile(new URL("../app/JournalApp.tsx", import.meta.url), "utf8");

  assert.match(source, /today/);
  assert.match(source, /record-track/);
  assert.match(source, /친구 기록장/);
  assert.match(source, /사진 추가/);
  assert.match(source, /룰렛 돌리기/);
  assert.match(source, /통계/);
  assert.match(source, /onPointerMove/);
  assert.doesNotMatch(source, /codex-preview|react-loading-skeleton/);
});
