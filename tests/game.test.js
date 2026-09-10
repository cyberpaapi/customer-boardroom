import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  addPlayer,
  apply,
  view,
  coins,
  median,
  PARTS,
  blankBuild,
  shopStats,
} from "../src/game.js";
function setup(n = 2) {
  const s = createState("ABC234", "h", 0);
  for (let i = 0; i < n; i++)
    addPlayer(s, { id: "c" + i, name: "Customer " + i, role: "customer" });
  return s;
}
function toPlan() {
  const s = setup();
  apply(s, "h", "NEXT");
  apply(s, "h", "NEXT", { force: true });
  for (let i = 0; i < 3; i++)
    addPlayer(s, { id: "s" + i, name: "Seller " + i, role: "seller" });
  return s;
}
function stock(s, id = "s0", n = 2) {
  apply(s, id, "SAVE_SHOP", {
    offers: PARTS.filter((p) => p.tier === 1).map((p) => ({
      part: p.id,
      stock: n,
      price: p.cost + 20,
    })),
  });
}
const lines = () =>
  PARTS.filter((p) => p.tier === 1).map((p) => ({ seller: "s0", part: p.id }));
test("curve is continuous, monotone, steep below 200; everyone earns a floor", () => {
  assert.equal(coins(200), 1500);
  assert.ok(coins(150) - coins(200) > coins(200) - coins(250));
  for (let t = 80; t < 2000; t++) assert.ok(coins(t) >= coins(t + 1));
  assert.ok(coins(2000) >= 600);
  assert.equal(median([200, 500, 180, 250, 210]), 210);
});
test("no class-size cap and exactly three sellers", () => {
  const s = setup(100);
  assert.equal(s.players.length, 101);
  for (let i = 0; i < 3; i++)
    addPlayer(s, { id: "s" + i, name: "Seller " + i, role: "seller" });
  assert.throws(() =>
    addPlayer(s, { id: "s4", name: "Fourth", role: "seller" }),
  );
});
test("5 challenges award income once and false starts are penalized", () => {
  const s = setup();
  apply(s, "h", "NEXT");
  for (let i = 0; i < 5; i++) {
    apply(s, "c0", "TRIAL_START", { nonce: "n" + i, delay: 2000 }, i * 5000);
    apply(
      s,
      "c0",
      "TRIAL_END",
      { nonce: "n" + i, ms: 200, early: i === 0 },
      i * 5000 + 2400,
    );
  }
  assert.equal(s.players[1].budget, 1500);
  assert.equal(s.players[1].trials[0], 2000);
  assert.throws(() =>
    apply(s, "c0", "TRIAL_START", { nonce: "bad", delay: 2000 }, 40000),
  );
});
test("invalid timing, wrong nonce, wrong role and wrong phase rejected", () => {
  const s = setup();
  assert.throws(() => apply(s, "c0", "TRIAL_START", { nonce: "x", delay: 2 }));
  apply(s, "h", "NEXT");
  apply(s, "c0", "TRIAL_START", { nonce: "n", delay: 2000 }, 0);
  assert.throws(() =>
    apply(s, "c0", "TRIAL_END", { nonce: "bad", ms: 200 }, 2200),
  );
  assert.throws(() =>
    apply(s, "c0", "TRIAL_END", { nonce: "n", ms: -2 }, 2200),
  );
  assert.throws(() => apply(s, "c0", "NEXT"));
});
test("seller privacy before round 2 and anonymous insight afterwards", () => {
  const s = toPlan();
  s.players[1].trials = [111, 222, 333, 444, 555];
  s.players[1].budget = 1234;
  s.players[1].budgetChoice = "100to150";
  const v = view(s, "s0");
  assert.equal(v.insights, undefined);
  assert.equal(v.roster, undefined);
  assert.ok(!JSON.stringify(v).includes("1234"));
  assert.ok(!JSON.stringify(v).includes("111"));
  s.phase = "plan2";
  const x = view(s, "s0");
  assert.equal(x.insights.count, 2);
  assert.equal(
    x.insights.bands.find((b) => b.label === "₹1,00,000–₹1,50,000").count,
    1,
  );
  assert.ok(!JSON.stringify(x).includes("Customer 0"));
  assert.ok(!JSON.stringify(x).includes('trials":[111'));
});
test("unlimited offers have no capital limit; price and phase rules remain", () => {
  const s = toPlan();
  apply(s, "s0", "SAVE_SHOP", {
    offers: PARTS.map((p) => ({ part: p.id, enabled: true, price: p.cost })),
  });
  assert.equal(shopStats(s, "s0").spend, 0);
  assert.equal(shopStats(s, "s0").profit, 0);
  assert.throws(() =>
    apply(s, "s0", "SAVE_SHOP", { offers: [{ part: "cpu1", price: 79 }] }),
  );
  apply(s, "h", "NEXT", { force: true });
  assert.throws(() => stock(s));
});
test("complete PC purchases record actual costs, reject duplicates, compute net profit", () => {
  const s = toPlan();
  stock(s);
  apply(s, "h", "NEXT", { force: true });
  apply(s, "c0", "BUY", { lines: lines() });
  assert.equal(shopStats(s, "s0").revenue, 360);
  assert.equal(shopStats(s, "s0").spend, 260);
  assert.equal(shopStats(s, "s0").profit, 100);
  assert.throws(() => apply(s, "c0", "BUY", { lines: lines() }));
  assert.equal(s.orders.length, 1);
  assert.throws(() => apply(s, "c1", "BUY", { lines: lines().slice(0, 4) }));
  apply(s, "c1", "BUY", { lines: lines() });
  assert.equal(shopStats(s, "s0").profit, 200);
});
test("overspending is rejected and unlimited offers never sell out", () => {
  const s = toPlan();
  stock(s, "s0", 1);
  apply(s, "h", "NEXT", { force: true });
  s.players[1].budget = 1;
  assert.throws(() => apply(s, "c0", "BUY", { lines: lines() }));
  assert.equal(shopStats(s, "s0").sold, 0);
  apply(s, "c1", "BUY", { lines: lines() });
  s.players[1].budget = 600;
  apply(s, "c0", "BUY", { lines: lines() });
  assert.equal(shopStats(s, "s0").sold, 10);
});
test("round 2 restores same budget and wishlist, clears offers and passes", () => {
  const s = toPlan();
  stock(s);
  apply(s, "h", "NEXT", { force: true });
  apply(s, "c0", "BUY", { lines: lines() });
  apply(s, "c1", "PASS");
  apply(s, "h", "NEXT");
  const b = s.players[1].budget;
  apply(s, "h", "NEXT");
  assert.equal(s.phase, "plan2");
  assert.equal(s.players[1].budget, b);
  assert.deepEqual(s.offers, {});
  assert.equal(s.players[1].done, false);
  assert.deepEqual(s.players[1].wishlist, blankBuild());
  assert.equal(s.results[1].customers[0].match, 5);
});
test("both markets complete, Force End and replay recover every phase", () => {
  const s = toPlan();
  for (let i = 0; i < 2; i++) {
    stock(s);
    apply(s, "h", "NEXT", { force: true });
    apply(s, "h", "NEXT", { force: true });
    if (!i) apply(s, "h", "NEXT");
  }
  assert.equal(s.phase, "final");
  assert.equal(Object.keys(s.results).length, 2);
  apply(s, "h", "PLAY_AGAIN");
  assert.equal(s.phase, "lobby");
  assert.deepEqual(s.results, {});
  assert.equal(s.players[1].budget, 0);
  assert.equal(s.players[1].trials.length, 0);
  apply(s, "h", "FORCE_END");
  assert.equal(s.phase, "ended");
});
test("component data complete and distinct", () => {
  assert.equal(new Set(PARTS.map((p) => p.id)).size, 15);
  assert.ok(PARTS.every((p) => p.name && p.detail && p.cost > 0));
});

test("free basic build is always available with no seller offers and no profit", () => {
  const s = toPlan();
  apply(s, "h", "NEXT", { force: true });
  const basic = PARTS.filter((p) => p.tier === 1).map((p) => ({
    seller: "__basic__",
    part: p.id,
  }));
  apply(s, "c0", "BUY", { lines: basic });
  assert.equal(s.orders[0].total, 0);
  assert.equal(shopStats(s, "s0").profit, 0);
  assert.throws(() =>
    apply(s, "c1", "BUY", {
      lines: basic.map((l, i) => (i === 0 ? { ...l, part: "cpu3" } : l)),
    }),
  );
  assert.equal(s.players.find((p) => p.id === "c1").done, false);
});

test("budget survey records exact range, validates input and keeps answers private", () => {
  const s = setup();
  apply(s, "h", "NEXT");
  assert.throws(() => apply(s, "c0", "SELECT_BUDGET", { choice: "invalid" }));
  apply(s, "c0", "SELECT_BUDGET", { choice: "150to200" });
  assert.equal(s.players[1].budget, 1750);
  assert.equal(s.players[1].budgetChoice, "150to200");
  apply(s, "h", "NEXT", { force: true });
  addPlayer(s, { id: "s0", name: "Seller", role: "seller" });
  assert.ok(!JSON.stringify(view(s, "s0")).includes("150to200"));
  s.phase = "plan2";
  s.round = 2;
  const v = view(s, "s0");
  assert.equal(v.insights.bands[2].count, 1);
  assert.equal(
    v.insights.bands.reduce((n, b) => n + b.count, 0),
    1,
  );
});
