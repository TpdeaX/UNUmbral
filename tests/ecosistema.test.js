const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  normalizeEcoTheme,
  resolveEcoUrl,
  applyIncomingEcoTheme,
  writeUmbralSnapshot,
} = require("../lib/ecosistema.js");

function makeMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("normalizeEcoTheme maps light/day and dark/night canonically", () => {
  assert.equal(normalizeEcoTheme("light"), "light");
  assert.equal(normalizeEcoTheme("day"), "light");
  assert.equal(normalizeEcoTheme("DARK"), "dark");
  assert.equal(normalizeEcoTheme("night"), "dark");
  assert.equal(normalizeEcoTheme("sepia"), null);
});

test("resolveEcoUrl handles github.io, localhost ports, LAN IPs, Capacitor and hash+eco_theme order", () => {
  assert.equal(
    resolveEcoUrl("atelier", { location: { hostname: "tpdeax.github.io", port: "", protocol: "https:" } }),
    "../atelier-diario/"
  );
  assert.equal(
    resolveEcoUrl("arena", {
      hash: "piano2d",
      location: { hostname: "tpdeax.github.io", port: "", protocol: "https:" },
    }),
    "../omni-arena/#piano2d"
  );

  const localAtelier = resolveEcoUrl("atelier", {
    hash: "singing",
    theme: "dark",
    location: { hostname: "localhost", port: "5177", protocol: "http:" },
  });
  assert.equal(localAtelier, "http://localhost:5176/?eco_theme=dark#singing");

  const localSelf = resolveEcoUrl("unumbral", {
    theme: "dark",
    location: { hostname: "localhost", port: "5177", protocol: "http:" },
  });
  assert.equal(localSelf, "http://localhost:5177/");

  const lanArena = resolveEcoUrl("arena", {
    theme: "light",
    location: { hostname: "192.168.1.40", port: "5177", protocol: "http:" },
  });
  assert.equal(lanArena, "http://192.168.1.40:5175/?eco_theme=light");

  const capDir = resolveEcoUrl("directorio", {
    isCapacitor: true,
    theme: "dark",
    location: { hostname: "localhost", port: "", protocol: "https:" },
  });
  assert.equal(capDir, "https://tpdeax.github.io/directorio/?eco_theme=dark");
});

test("applyIncomingEcoTheme reads ?eco_theme=, saves canonical umbral-theme and cleans URL", () => {
  const storage = makeMemoryStorage();
  let replacedUrl = null;
  const attrs = {};
  const fakeWin = {
    location: { href: "http://localhost:5177/?eco_theme=dark#hoy" },
    history: {
      replaceState: (_s, _t, u) => {
        replacedUrl = u;
      },
    },
  };
  const fakeDoc = {
    documentElement: {
      setAttribute: (k, v) => {
        attrs[k] = v;
      },
    },
  };

  const result = applyIncomingEcoTheme({ storage, window: fakeWin, document: fakeDoc });
  assert.equal(result, "dark");
  assert.equal(storage.getItem("umbral-theme"), "dark");
  assert.equal(attrs["data-theme"], "dark");
  assert.equal(replacedUrl, "/#hoy");
});

test("writeUmbralSnapshot stores counts in unumbral_last_snapshot_v1 and updates legacy only if present", () => {
  const storage = makeMemoryStorage();
  const snap = writeUmbralSnapshot(
    { coursesCount: 6, pendingTasks: 4, todayClasses: 2, cyclesCount: 1, updatedAt: 123456 },
    storage
  );
  assert.deepEqual(snap, {
    version: 1,
    updatedAt: 123456,
    coursesCount: 6,
    pendingTasks: 4,
    todayClasses: 2,
    cyclesCount: 1,
  });
  assert.equal(storage.getItem("atelier_umbral_snapshot_v1"), null);

  storage.setItem("atelier_umbral_snapshot_v1", JSON.stringify({ cursos: [{ id: "1" }] }));
  writeUmbralSnapshot({ coursesCount: 7, pendingTasks: 1, todayClasses: 3, cyclesCount: 1, updatedAt: 999 }, storage);
  const legacy = JSON.parse(storage.getItem("atelier_umbral_snapshot_v1"));
  assert.equal(legacy._updatedAt, 999);
  assert.equal(legacy.cursos.length, 1);
});

test("index.html includes .eco-switch bar with all 4 apps and lib/ecosistema.js", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /class="eco-switch"/);
  assert.match(html, /data-eco-app="directorio"/);
  assert.match(html, /data-eco-app="atelier"/);
  assert.match(html, /data-eco-app="unumbral"/);
  assert.match(html, /data-eco-app="arena"/);
  assert.match(html, /lib\/ecosistema\.js/);
});
