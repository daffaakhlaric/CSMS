import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import {
  MultiFormatReader,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from "@zxing/library";
import { seedState } from "../lib/eam/engine";
import { resolveCameraCode } from "../lib/eam/scanning";
test("camera decoder reads printed EAM QR and rejects wrong target without changing inventory", () => {
  const state = seedState(),
    before = JSON.stringify(state);
  for (const [target, code] of [
    ["pallet", "EAM:PLT-001"],
    ["sack", "EAM:SK-00001"],
    ["loading", "EAM:SK-00001"],
  ] as const) {
    const qr = QRCode.create(code),
      scale = 6,
      margin = 4,
      size = (qr.modules.size + margin * 2) * scale,
      pixels = new Uint8ClampedArray(size * size).fill(255);
    for (let y = 0; y < qr.modules.size; y++)
      for (let x = 0; x < qr.modules.size; x++)
        if (qr.modules.get(y, x))
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++)
              pixels[
                ((y + margin) * scale + dy) * size + (x + margin) * scale + dx
              ] = 0;
    const decoded = new MultiFormatReader()
      .decode(
        new BinaryBitmap(
          new HybridBinarizer(new RGBLuminanceSource(pixels, size, size)),
        ),
      )
      .getText();
    assert.equal(decoded, code);
    assert.equal(resolveCameraCode(state, target, decoded).qr, code);
  }
  assert.ok(resolveCameraCode(state, "loading", "EAM:PLT-001").error);
  assert.ok(resolveCameraCode(state, "pallet", "EAM:SK-00001").error);
  assert.ok(resolveCameraCode(state, "sack", "unknown").error);
  assert.equal(resolveCameraCode(state, "sack", " SK-00001 ").id, "SK-00001");
  assert.equal(JSON.stringify(state), before);
});

import { loadingScanIssue } from "../lib/eam/scanning";
test("scan errors identify closed order and mismatched owner; valid loading remains allowed", () => {
  const s = seedState();
  const order = s.orders[0],
    sack = s.sacks[0];
  assert.equal(loadingScanIssue(s, order.id, sack.id), null);
  order.dispatched = true;
  assert.match(loadingScanIssue(s, order.id, sack.id)!, /sudah dispatch/);
  order.dispatched = false;
  const other = s.sacks.find((a) => a.owner !== order.owner)!;
  assert.match(loadingScanIssue(s, order.id, other.id)!, /sedangkan/);
  assert.ok(loadingScanIssue(s, "", sack.id));
});
