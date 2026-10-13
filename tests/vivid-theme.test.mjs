import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function contrast(foreground, background) {
  const luminance = (hex) => {
    const rgb = hex.slice(1).match(/../g).map(channel => Number.parseInt(channel, 16) / 255);
    const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("Aurora UI uses accessible saturated text and button contrast", () => {
  const css = readFileSync(new URL("../app/gemini-inspired.css", import.meta.url), "utf8");
  for (const hex of ["#090e1e", "#17223a", "#f8fbff", "#c7d4ed", "#49f1db", "#4f90ff", "#071326"]) {
    assert.ok(css.includes(hex), `Missing theme color ${hex}`);
  }
  assert.ok(contrast("#f8fbff", "#090e1e") >= 7, "body text must exceed AAA contrast");
  assert.ok(contrast("#c7d4ed", "#17223a") >= 7, "secondary text must exceed AAA contrast");
  assert.ok(contrast("#071326", "#4f90ff") >= 4.5, "primary action text must exceed AA contrast");
  assert.ok(css.includes(":focus-visible"), "keyboard users need visible focus outlines");
  assert.ok(css.includes("@media(max-width:600px)"), "mobile layout should remain responsive");
  assert.ok(css.includes("prefers-reduced-motion"), "motion accessibility must be preserved");
});

test("Installable app and browser chrome use the same ARTSS ONE palette", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.equal(manifest.name, "ARTSS ONE — AI Workspace");
  assert.equal(manifest.theme_color, "#090e1e");
  assert.equal(manifest.background_color, "#090e1e");
  assert.match(layout, /themeColor: "#090e1e"/);
  assert.match(layout, /\.\/gemini-inspired\.css/);
});
