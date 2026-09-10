export const CATEGORIES = ["cpu", "gpu", "ram", "ssd", "case"];
export const LABELS = {
  cpu: "Processor",
  gpu: "Graphics",
  ram: "Memory",
  ssd: "Storage",
  case: "Case + essentials",
};
export const PARTS = [
  {
    id: "cpu1",
    category: "cpu",
    name: "Everyday CPU",
    detail: "Study, browsing, everyday work",
    cost: 80,
    tier: 1,
  },
  {
    id: "cpu2",
    category: "cpu",
    name: "Performance CPU",
    detail: "Coding, multitasking, editing",
    cost: 220,
    tier: 2,
  },
  {
    id: "cpu3",
    category: "cpu",
    name: "Studio CPU",
    detail: "Heavy rendering and simulation",
    cost: 600,
    tier: 3,
  },
  {
    id: "gpu1",
    category: "gpu",
    name: "Essential graphics",
    detail: "Documents, streaming, light games",
    cost: 60,
    tier: 1,
  },
  {
    id: "gpu2",
    category: "gpu",
    name: "Gaming graphics",
    detail: "Smooth gaming and creative work",
    cost: 350,
    tier: 2,
  },
  {
    id: "gpu3",
    category: "gpu",
    name: "Ultra graphics",
    detail: "Demanding games and 3D scenes",
    cost: 1000,
    tier: 3,
  },
  {
    id: "ram1",
    category: "ram",
    name: "8 GB memory",
    detail: "Everyday essentials",
    cost: 40,
    tier: 1,
  },
  {
    id: "ram2",
    category: "ram",
    name: "16 GB memory",
    detail: "Comfortable multitasking",
    cost: 100,
    tier: 2,
  },
  {
    id: "ram3",
    category: "ram",
    name: "32 GB memory",
    detail: "Large creative projects",
    cost: 240,
    tier: 3,
  },
  {
    id: "ssd1",
    category: "ssd",
    name: "256 GB SSD",
    detail: "A small, fast workspace",
    cost: 40,
    tier: 1,
  },
  {
    id: "ssd2",
    category: "ssd",
    name: "512 GB SSD",
    detail: "Room for work and a few games",
    cost: 100,
    tier: 2,
  },
  {
    id: "ssd3",
    category: "ssd",
    name: "1 TB SSD",
    detail: "A larger game and media library",
    cost: 260,
    tier: 3,
  },
  {
    id: "case1",
    category: "case",
    name: "Simple case",
    detail: "Clean and functional",
    cost: 40,
    tier: 1,
  },
  {
    id: "case2",
    category: "case",
    name: "Quiet case",
    detail: "Understated, sound-dampened look",
    cost: 90,
    tier: 2,
  },
  {
    id: "case3",
    category: "case",
    name: "RGB showcase",
    detail: "Colorful lighting and a display window",
    cost: 180,
    tier: 3,
  },
];
export const BASIC_SELLER = "__basic__";
export const referencePrice = (part) =>
  part.tier === 1 ? 0 : Math.round(part.cost * 1.5);
export const BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const PHASES = [
  "lobby",
  "reaction",
  "plan1",
  "shop1",
  "result1",
  "plan2",
  "shop2",
  "final",
];
export const PHASE_LABELS = {
  lobby: "Everyone in",
  reaction: "Earn your income",
  plan1: "Round 1 · Set your shop",
  shop1: "Round 1 · Build your PC",
  result1: "Round 1 · The results",
  plan2: "Round 2 · Meet your customers",
  shop2: "Round 2 · Build again",
  final: "The boardroom reveal",
  ended: "Session ended",
};
export function coins(ms) {
  return Math.round(
    600 + 900 * Math.exp((200 - Math.max(80, Math.min(2000, ms))) / 65),
  );
}
export function median(a) {
  return [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
}
export function blankBuild() {
  return Object.fromEntries(CATEGORIES.map((c) => [c, c + "1"]));
}
export function fail(message) {
  throw new Error(message);
}
export function assert(ok, message) {
  if (!ok) fail(message);
}
export function customers(s) {
  return s.players.filter((p) => p.role === "customer");
}
export function sellers(s) {
  return s.players.filter((p) => p.role === "seller");
}
export function createState(code, hostId, now) {
  return {
    code,
    revision: 0,
    phase: "lobby",
    round: 0,
    players: [{ id: hostId, name: "Presenter", role: "host" }],
    offers: {},
    orders: [],
    results: {},
    createdAt: now,
    expiresAt: now + 86400000,
    log: [],
  };
}
export function addPlayer(s, p) {
  assert(
    s.phase === "lobby" || (p.role === "seller" && s.phase === "plan1"),
    "Joining has closed. Ask the presenter to start a new session.",
  );
  assert(p.role === "customer" || p.role === "seller", "Invalid role.");
  assert(
    p.name && p.name.length <= 24,
    "Use a name between 1 and 24 characters.",
  );
  assert(
    !s.players.some((x) => x.name.toLowerCase() === p.name.toLowerCase()),
    "That name is already taken. Add an initial.",
  );
  if (p.role === "seller")
    assert(sellers(s).length < 3, "All three seller places are taken.");
  s.players.push({
    ...p,
    trials: [],
    budget: 0,
    wishlist: blankBuild(),
    use: "Everyday work",
    preferenceSaved: false,
    done: false,
  });
}
export const offerEnabled = (o) =>
  !!o && (o.enabled ?? (o.stock === undefined || o.stock > 0));
export function shopStats(s, id) {
  const list = Object.values(s.offers[id] || {});
  const spend = list.reduce((n, o) => n + o.sold * BY_ID[o.part].cost, 0);
  const revenue = list.reduce((n, o) => n + o.sold * o.price, 0);
  const sold = list.reduce((n, o) => n + o.sold, 0);
  return {
    spend,
    revenue,
    profit: revenue - spend,
    sold,
  };
}
export function budgetBand(b) {
  return b < 1000
    ? "600–999"
    : b < 2000
      ? "1,000–1,999"
      : b < 4000
        ? "2,000–3,999"
        : "4,000+";
}
export function insights(s) {
  const cs = customers(s);
  return {
    count: cs.length,
    bands: ["600–999", "1,000–1,999", "2,000–3,999", "4,000+"].map((label) => ({
      label,
      count: cs.filter((p) => budgetBand(p.budget) === label).length,
    })),
    uses: ["Everyday work", "Gaming", "Creative work", "Coding"].map(
      (label) => ({ label, count: cs.filter((p) => p.use === label).length }),
    ),
    parts: PARTS.map((part) => ({
      ...part,
      count: cs.filter((p) => p.wishlist[part.category] === part.id).length,
    })),
    responses: cs.filter((p) => p.preferenceSaved).length,
  };
}
function endRound(s) {
  s.results[s.round] = {
    sellers: sellers(s).map((p) => ({
      id: p.id,
      name: p.name,
      ...shopStats(s, p.id),
    })),
    customers: customers(s).map((p) => {
      const o = s.orders.find((o) => o.buyer === p.id && o.round === s.round);
      return {
        id: p.id,
        bought: !!o,
        spent: o?.total || 0,
        match: o
          ? o.lines.filter((l) => p.wishlist[BY_ID[l.part].category] === l.part)
              .length
          : 0,
      };
    }),
  };
}
function startPlanning(s, round) {
  s.round = round;
  s.offers = {};
  customers(s).forEach((p) => (p.done = false));
  sellers(s).forEach((p) => (p.ready = false));
}
export function apply(s, actorId, type, payload = {}, now = Date.now()) {
  const p = s.players.find((p) => p.id === actorId);
  assert(p, "Seat not found.");
  const host = p.role === "host";
  if (type === "NEXT") {
    assert(host, "Only the presenter controls the phases.");
    const idx = PHASES.indexOf(s.phase);
    assert(idx >= 0 && idx < 7, "This game is complete.");
    if (s.phase === "lobby")
      assert(customers(s).length > 0, "At least one customer must join.");
    if (s.phase === "reaction") {
      const unfinished = customers(s).filter(
        (p) => p.trials.length < 5 || !p.preferenceSaved,
      );
      assert(
        unfinished.length === 0 || payload.force === true,
        "Some customers are still earning income or choosing preferences.",
      );
      customers(s).forEach((p) => {
        if (!p.budget) p.budget = 600;
      });
      startPlanning(s, 1);
    }
    if (s.phase === "plan1" || s.phase === "plan2") {
      assert(sellers(s).length === 3, "Wait for all three sellers.");
      assert(
        sellers(s).every((p) => p.ready) || payload.force === true,
        "Some sellers have not opened their shop.",
      );
    }
    if (s.phase === "shop1" || s.phase === "shop2") {
      assert(
        customers(s).every((p) => p.done) || payload.force === true,
        "Some customers are still shopping.",
      );
      endRound(s);
    }
    if (s.phase === "result1") startPlanning(s, 2);
    s.phase = PHASES[idx + 1];
  } else if (type === "FORCE_END") {
    assert(host, "Presenter only.");
    if (s.phase.startsWith("shop")) endRound(s);
    s.phase = "ended";
  } else if (type === "PLAY_AGAIN") {
    assert(host, "Presenter only.");
    Object.assign(s, {
      phase: "lobby",
      round: 0,
      offers: {},
      orders: [],
      results: {},
    });
    s.players.forEach((p) => {
      p.trials = [];
      p.budget = 0;
      p.preferenceSaved = false;
      p.done = false;
      p.ready = false;
      delete p.challenge;
    });
  } else if (type === "TRIAL_START") {
    assert(
      p.role === "customer" && s.phase === "reaction",
      "Reaction round is not open.",
    );
    assert(p.trials.length < 5, "All five attempts are complete.");
    assert(!p.challenge, "Complete the current attempt.");
    assert(
      typeof payload.nonce === "string" && Number.isFinite(payload.delay),
      "Invalid challenge.",
    );
    p.challenge = { nonce: payload.nonce, start: now, delay: payload.delay };
  } else if (type === "TRIAL_END") {
    assert(
      p.role === "customer" && s.phase === "reaction",
      "Reaction round is not open.",
    );
    assert(
      p.challenge && p.challenge.nonce === payload.nonce,
      "Attempt has expired.",
    );
    const t = payload.ms;
    assert(
      Number.isFinite(t) && t >= 0 && t <= 10000,
      "Invalid reaction time.",
    );
    const early =
      payload.early === true ||
      t < 80 ||
      now - p.challenge.start < p.challenge.delay;
    const ms = early ? 2000 : Math.min(2000, Math.round(t));
    p.trials.push(ms);
    delete p.challenge;
    if (p.trials.length === 5) p.budget = coins(median(p.trials));
  } else if (type === "PREFERENCES") {
    assert(
      p.role === "customer" && s.phase === "reaction",
      "Preferences are locked after the income round.",
    );
    assert(
      ["Everyday work", "Gaming", "Creative work", "Coding"].includes(
        payload.use,
      ),
      "Choose a PC use.",
    );
    assert(
      CATEGORIES.every((c) => BY_ID[payload.wishlist?.[c]]?.category === c),
      "Choose a part for every category.",
    );
    p.use = payload.use;
    p.wishlist = { ...payload.wishlist };
    p.preferenceSaved = true;
  } else if (type === "SAVE_SHOP") {
    assert(
      p.role === "seller" && (s.phase === "plan1" || s.phase === "plan2"),
      "Shop planning is closed.",
    );
    assert(
      Array.isArray(payload.offers) && payload.offers.length <= PARTS.length,
      "Invalid shop.",
    );
    const os = {};
    for (const x of payload.offers) {
      assert(BY_ID[x.part] && !os[x.part], "Unknown or duplicate component.");
      assert(
        Number.isInteger(x.price) &&
          x.price >= BY_ID[x.part].cost &&
          x.price <= 10000,
        "Prices must be whole coins, at least the wholesale cost and at most 10,000.",
      );
      os[x.part] = {
        part: x.part,
        enabled: x.enabled ?? (x.stock === undefined || x.stock > 0),
        price: x.price,
        sold: 0,
      };
    }
    assert(
      Object.values(os).some(offerEnabled),
      "Choose at least one component to offer.",
    );
    s.offers[p.id] = os;
    p.ready = true;
  } else if (type === "BUY") {
    assert(
      p.role === "customer" && (s.phase === "shop1" || s.phase === "shop2"),
      "The market is closed.",
    );
    assert(!p.done, "You already finished this round.");
    assert(
      Array.isArray(payload.lines) && payload.lines.length === 5,
      "Select one part in every category.",
    );
    const seen = new Set();
    let total = 0;
    const lines = payload.lines.map((l) => {
      const part = BY_ID[l.part],
        o = s.offers[l.seller]?.[l.part];
      assert(part && !seen.has(part.category), "Choose one part per category.");
      seen.add(part.category);
      assert(
        offerEnabled(o),
        "This component is not offered. Update your build.",
      );
      total += o.price;
      return {
        seller: l.seller,
        part: l.part,
        price: o.price,
        cost: part.cost,
      };
    });
    assert(total <= p.budget, "Your build costs more than your budget.");
    for (const l of lines)
      if (l.seller !== BASIC_SELLER) s.offers[l.seller][l.part].sold++;
    s.orders.push({ buyer: p.id, round: s.round, lines, total });
    p.done = true;
  } else if (type === "PASS") {
    assert(
      p.role === "customer" &&
        (s.phase === "shop1" || s.phase === "shop2") &&
        !p.done,
      "You cannot pass now.",
    );
    p.done = true;
  } else fail("Unknown action.");
  s.log.push({ type, at: now, phase: s.phase });
  s.log = s.log.slice(-30);
  return s;
}
export function view(s, id) {
  const p = s.players.find((p) => p.id === id);
  assert(p, "Invalid seat.");
  const host = p.role === "host";
  const reveal =
    s.phase === "plan2" || s.phase === "shop2" || s.phase === "final";
  const publicMarket =
    s.phase.startsWith("shop") ||
    s.phase === "result1" ||
    s.phase === "final" ||
    s.phase === "ended";
  const v = {
    code: s.code,
    revision: s.revision,
    phase: s.phase,
    round: s.round,
    expiresAt: s.expiresAt,
    me: { ...p },
    counts: {
      customers: customers(s).length,
      sellers: sellers(s).length,
      earned: customers(s).filter((x) => x.trials.length === 5).length,
      preferences: customers(s).filter((x) => x.preferenceSaved).length,
      finished: customers(s).filter((x) => x.done).length,
      shopsReady: sellers(s).filter((x) => x.ready).length,
    },
    sellers: sellers(s).map((x) => ({
      id: x.id,
      name: x.name,
      ready: !!x.ready,
    })),
    offers:
      publicMarket || host
        ? s.offers
        : p.role === "seller"
          ? { [p.id]: s.offers[p.id] || {} }
          : {},
    results: {},
  };
  if (p.challenge)
    v.me.challenge = { nonce: p.challenge.nonce, delay: p.challenge.delay };
  if (p.role === "customer")
    v.order =
      s.orders.find((o) => o.buyer === p.id && o.round === s.round) || null;
  if (host || p.role === "seller")
    v.myStats = p.role === "seller" ? shopStats(s, p.id) : null;
  if (host)
    v.roster = s.players.map((x) => ({
      id: x.id,
      name: x.name,
      role: x.role,
      earned: x.trials?.length === 5,
      preferences: x.preferenceSaved,
      done: x.done,
      ready: x.ready,
    }));
  for (const [r, result] of Object.entries(s.results)) {
    v.results[r] = {
      sellers: result.sellers.map((seller) => {
        const lines = s.orders
          .filter((o) => String(o.round) === r)
          .flatMap((o) => o.lines)
          .filter((l) => l.seller === seller.id);
        const spend = lines.reduce((n, l) => n + l.cost, 0),
          revenue = lines.reduce((n, l) => n + l.price, 0);
        return {
          id: seller.id,
          name: seller.name,
          spend,
          revenue,
          profit: revenue - spend,
          sold: lines.length,
        };
      }),
      buyers: result.customers.filter((c) => c.bought).length,
      totalCustomers: result.customers.length,
      matchedParts: result.customers.reduce((n, c) => n + c.match, 0),
    };
    if (p.role === "customer")
      v.results[r].mine = result.customers.find((c) => c.id === p.id);
  }
  if ((host || p.role === "seller") && reveal) v.insights = insights(s);
  return v;
}
