import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareInterventions,
  effectiveness,
  EvaluationInput,
  validEvaluation,
} from "../lib/effectiveness";
import { POST } from "../app/api/effectiveness/route";
const input: EvaluationInput = {
  roomId: "CS-01",
  scenario: "stable",
  target: -20,
  warning: -15,
  critical: -10,
  samples: Array.from({ length: 16 }, (_, i) => ({
    at: i * 2000,
    temperature: -20,
    valid: true,
  })),
};
test("score distinguishes stable, critical and missing observations", () => {
  assert.equal(effectiveness(input).score, 100);
  assert.equal(
    effectiveness({
      ...input,
      samples: input.samples.map((s) => ({ ...s, valid: false })),
    }).score,
    0,
  );
  const critical = effectiveness({
    ...input,
    samples: input.samples.map((s) => ({ ...s, temperature: -8 })),
  });
  assert.equal(critical.score, 15);
  assert.equal(critical.criticalSeconds, 30);
  assert.equal(effectiveness({ ...input, samples: [] }).score, null);
});
test("time weighting and invalid input", () => {
  const weighted = effectiveness({
    ...input,
    samples: [
      { at: 0, temperature: -20, valid: true },
      { at: 1000, temperature: -20, valid: false },
      { at: 10000, temperature: -20, valid: false },
    ],
  });
  assert.equal(weighted.score, 10);
  assert.equal(validEvaluation(input), true);
  assert.equal(validEvaluation({ ...input, warning: -20 }), false);
  assert.equal(
    validEvaluation({
      ...input,
      samples: [input.samples[0], input.samples[0]],
    }),
    false,
  );
});
test("intervention tool predicts faster recovery without mutating input", () => {
  const hot = {
    ...input,
    samples: input.samples.map((s) => ({ ...s, temperature: -8 })),
  };
  const result = compareInterventions(hot);
  assert.ok(result[1].score! > result[0].score!);
  assert.equal(hot.samples[0].temperature, -8);
});
test("API missing key, origin restriction and bounded two-step agent with mocked OpenAI", async () => {
  const original = process.env.OPENAI_API_KEY,
    fetchOriginal = globalThis.fetch;
  const request = (origin = "http://localhost:3000") =>
    new Request("http://localhost:3000/api/effectiveness", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(input),
    });
  try {
    delete process.env.OPENAI_API_KEY;
    assert.equal((await POST(new Request("http://0.0.0.0:3000/api/effectiveness", {
      method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      body: JSON.stringify(input),
    }))).status, 503);
    assert.equal((await POST(request())).status, 503);
    assert.equal((await POST(request("https://example.com"))).status, 403);
    process.env.OPENAI_API_KEY = "test-only";
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(options!.body as string);
      assert.equal(body.store, false);
      if (calls === 1)
        return Response.json({
          status: "completed",
          output: [
            {
              type: "function_call",
              name: "compare_interventions",
              call_id: "test",
              arguments: "{}",
            },
          ],
        });
      assert.equal(body.input.at(-1).type, "function_call_output");
      return Response.json({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  summary: "Stabil",
                  recommendations: ["Pantau suhu"],
                  limitations: "Demo",
                }),
              },
            ],
          },
        ],
      });
    };
    const result = await POST(request());
    assert.equal(result.status, 200);
    assert.equal((await result.json()).metrics.score, 100);
    assert.equal(calls, 2);
    assert.equal((await POST(request())).status, 429);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});
