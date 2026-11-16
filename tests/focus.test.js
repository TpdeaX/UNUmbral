const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { formatearMinSeg, resolverUrlEcosistema } = require("../lib/focusTimer.js");

test("formatearMinSeg formats seconds cleanly as MM:SS", () => {
  assert.equal(formatearMinSeg(1500), "25:00");
  assert.equal(formatearMinSeg(65), "01:05");
  assert.equal(formatearMinSeg(0), "00:00");
  assert.equal(formatearMinSeg(-10), "00:00");
});

test("resolverUrlEcosistema resolves GitHub Pages and localhost links properly", () => {
  assert.equal(resolverUrlEcosistema("atelier", "tpdeax.github.io"), "../atelier-diario/");
  assert.equal(resolverUrlEcosistema("calm", "tpdeax.github.io"), "../atelier-diario/#calm");
  assert.equal(resolverUrlEcosistema("arena", "tpdeax.github.io"), "../omni-arena/");
  assert.equal(resolverUrlEcosistema("atelier", "localhost"), "http://localhost:5176/");
});

test("index.html includes focus timer and ecosystem controls with MIT credit to Té Verde", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="focus-clock-display"/);
  assert.match(html, /id="eco-link-atelier"/);
  assert.match(html, /id="eco-link-calm"/);
  assert.match(html, /id="eco-link-arena"/);
  assert.match(html, /Té Verde/);
});
