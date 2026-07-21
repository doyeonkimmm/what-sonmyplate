import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the food diary draft", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /오늘모먹지/);
  assert.match(html, /음식/);
  assert.match(html, />촬영</);
  assert.match(html, />업로드</);
  assert.match(html, /손그림/);
  assert.doesNotMatch(html, /사진 없이도 기록할 수 있습니다/);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
