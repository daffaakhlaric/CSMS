import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST } from "../app/api/telemetry/route";
test("gateway rejects unconfigured, unsigned, expired, malformed and oversized requests", async () => {
  const keys = [
    "CSMS_GATEWAY_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    delete process.env.CSMS_GATEWAY_SECRET;
    assert.equal(
      (
        await POST(
          new Request("http://localhost/api/telemetry", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
      503,
    );
    process.env.CSMS_GATEWAY_SECRET = "test-only-signing-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
    const request = (body: string, stamp = String(Date.now()), signed = true) =>
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body,
        headers: {
          "x-csms-timestamp": stamp,
          "x-csms-signature": signed
            ? createHmac("sha256", "test-only-signing-key")
                .update(stamp + "." + body)
                .digest("hex")
            : "0".repeat(64),
        },
      });
    assert.equal((await POST(request("{}", undefined, false))).status, 401);
    assert.equal(
      (await POST(request("{}", String(Date.now() - 600000)))).status,
      401,
    );
    assert.equal((await POST(request("not-json"))).status, 400);
    assert.equal((await POST(request("null"))).status, 400);
    assert.equal((await POST(request("{}"))).status, 400);
    assert.equal((await POST(request("a".repeat(5000)))).status, 413);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
