import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the pixel kitchen start screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");

  const html = await response.text();
  assert.match(html, /오늘 뭐 먹지/);
  assert.match(html, /카메라를 눌러 기록하기/);
  assert.match(html, /frame-1\.svg/);
  assert.match(html, /camera-prop/);
  assert.doesNotMatch(html, /flow-strip|fridge-magnets/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
