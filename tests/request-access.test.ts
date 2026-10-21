import test from "node:test";
import assert from "node:assert/strict";
import { allowedAppOrigin, publicAccessError } from "../lib/request-access";

test("forwarded access accepts only the configured origin and requires login", async () => {
  const previous = process.env.CSMS_PUBLIC_ORIGIN;
  process.env.CSMS_PUBLIC_ORIGIN = "https://test.trycloudflare.com";
  const request = (origin: string, host = "test.trycloudflare.com") =>
    new Request("http://localhost:3001/api/eam", { headers: { origin, host } });
  try {
    assert.equal(allowedAppOrigin(request("https://test.trycloudflare.com")), true);
    assert.equal(allowedAppOrigin(request("https://other.trycloudflare.com")), false);
    assert.equal(allowedAppOrigin(request("https://test.trycloudflare.com", "other.trycloudflare.com")), false);
    assert.equal(allowedAppOrigin(request("null")), false);
    assert.equal((await publicAccessError(request("https://test.trycloudflare.com")))?.status, 401);
    assert.equal((await publicAccessError(request("http://localhost:3001", "localhost:3001")))?.status, 401);
  } finally {
    if (previous === undefined) delete process.env.CSMS_PUBLIC_ORIGIN;
    else process.env.CSMS_PUBLIC_ORIGIN = previous;
  }
});
