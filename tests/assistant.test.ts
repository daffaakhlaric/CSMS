import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../lib/domain";
import { assistantContext } from "../lib/assistant-context";
import { POST } from "../app/api/assistant/route";
test("assistant context aggregates stock and resolves only requested sacks", () => {
  const state = createDemo();
  const context = assistantContext(state, "Di mana KRG-00001 dan KRG00300?", "local");
  assert.equal(context.totals.count, 500);
  assert.equal(context.totals.pcs, 6000);
  assert.equal(context.groups.reduce((n, g) => n + g.sacks, 0), 500);
  assert.equal(context.requestedSacks.length, 2);
  assert.equal(context.rooms[0].stock.count, 250);
  assert.equal(context.rooms[0].source, "SIMULATED");
  assert.equal(assistantContext(state, "KRG-99999", "local").requestedSacks.length, 0);
});
test("chat validates boundaries and uses server key with snapshot", async () => {
  const key = process.env.OPENAI_API_KEY, original = globalThis.fetch;
  const req = (body: unknown, origin = "http://127.0.0.1:3000") => new Request("http://127.0.0.1:3000/api/assistant", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
  try {
    delete process.env.OPENAI_API_KEY;
    assert.equal((await POST(req({}))).status, 503);
    process.env.OPENAI_API_KEY = "test";
    assert.equal((await POST(req({}, "https://example.com"))).status, 403);
    assert.equal((await POST(req({ messages: [{ role: "system", content: "bad" }], context: {} }))).status, 400);
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      assert.equal(body.store, false);
      assert.match(body.input[0].content, /SNAPSHOT/);
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: "Stok 500 karung." }] }] });
    };
    const response = await POST(req({ messages: [{ role: "user", content: "Berapa stok?" }], context: assistantContext(createDemo(), "stok", "local") }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).answer, "Stok 500 karung.");
  } finally { globalThis.fetch = original; if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; }
});
