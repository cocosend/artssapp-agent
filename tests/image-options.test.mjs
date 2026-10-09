import test from "node:test";
import assert from "node:assert/strict";
import { imageOptions, imageSizes } from "../lib/image-options.ts";

test("image generation has safe, predictable defaults", () => {
  assert.deepEqual(imageOptions(undefined), { aspect: "square", quality: "low", size: "1024x1024" });
  assert.deepEqual(imageOptions({ aspect: "unsupported", quality: "unlimited" }), { aspect: "square", quality: "low", size: "1024x1024" });
  assert.deepEqual(imageOptions(null), { aspect: "square", quality: "low", size: "1024x1024" });
});

test("iPhone portrait, landscape and square map to actual OpenAI image sizes", () => {
  assert.equal(imageOptions({ aspect: "portrait", quality: "high" }).size, "1024x1536");
  assert.equal(imageOptions({ aspect: "landscape", quality: "medium" }).size, "1536x1024");
  assert.equal(imageOptions({ aspect: "square", quality: "low" }).size, "1024x1024");
  assert.equal(imageOptions({ aspect: "portrait", quality: "high" }).quality, "high");
  assert.deepEqual(Object.keys(imageSizes).sort(), ["landscape", "portrait", "square"]);
});

test("unexpected payload types do not bypass image-size validation", () => {
  assert.equal(imageOptions({ aspect: ["landscape"], quality: 3 }).size, "1024x1024");
  assert.equal(imageOptions("landscape").size, "1024x1024");
});
