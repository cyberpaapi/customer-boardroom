import "./styles.css";
import "./builder.css";
import {
  builderScreen,
  mountPreview,
  partImage,
  cheapestOffer,
} from "./builder.js";
let builderStep = 0,
  previewBuild = blankBuild();
import QRCode from "qrcode";
import { RoomClient } from "./network.js";
import {
  BUDGET_OPTIONS,
  linePrice,
  referencePrice,
  offerEnabled,
  PARTS,
  BY_ID,
  CATEGORIES,
  LABELS,
  PHASE_LABELS,
  blankBuild,
  coins,
  median,
} from "./game.js";
const root = document.querySelector("#app");
let state = null,
  status = "Not connected",
  busy = false,
  error = "",
  entry = "join",
  sellerQR = 0,
  reaction = null,
  reactTimer = null,
  lastTrial = "",
  draftShop = {},
  shopKey = "",
  cart = {},
  wish = blankBuild(),
  use = "Everyday work",
  prefKey = "",
  lastPhase = "",
  qrCache = new Map();
const params = new URLSearchParams(location.search),
  roomParam = (params.get("room") || "").toUpperCase(),
  invite = params.get("seller") || "";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => "₹" + (Number(n || 0) * 100).toLocaleString("en-IN");
let budgetPick = "";
const icon = (name) =>
  ({ cpu: "◈", gpu: "▣", ram: "▤", ssd: "▰", case: "▥" })[name] || "◆";
const client = new RoomClient(
  (s) => {
    const was = state;
    state = s;
    if (was?.phase !== s.phase) {
      cart = {};
      builderStep = 0;
      previewBuild = blankBuild();
      lastTrial = "";
      if (reaction) {
        clearTimeout(reactTimer);
        reaction = null;
      }
      lastPhase = s.phase;
    }
    const editing =
      was?.phase === s.phase &&
      ((s.me.role === "seller" && s.phase.startsWith("plan")) ||
        (s.me.role === "customer" &&
          s.phase === "reaction" &&
          !!s.me.budgetChoice));
    if (!reaction && !editing) render();
    if (was?.phase !== s.phase) window.scrollTo(0, 0);
  },
  (s) => {
    status = s;
    const el = document.querySelector("#connection");
    if (el) el.textContent = s;
  },
);
const btn = (text, action, cls = "", disabled = false) =>
  `<button class="button ${cls}" data-action="${action}" ${disabled || busy ? "disabled" : ""}>${text}</button>`;
const pill = (t) => `<span class="pill">${t}</span>`;
function header() {
  return `<header><a class="brand" href="${location.pathname}"><span class="brand-mark">b.</span><span>the boardroom<span class="brand-sub">A CUSTOMER EXPERIMENT</span></span></a><span class="connection" id="connection">${esc(status)}</span></header>`;
}
function shell(html) {
  root.innerHTML =
    header() +
    `<main>${error ? `<div class="error" role="alert">${esc(error)} ${btn("Dismiss", "dismiss", "small ghost")}</div>` : ""}${html}</main><footer>Customer in the Boardroom · Group 11 <span>Fictional components. Real decisions.</span></footer>`;
  renderQRs();
  document.body.classList.toggle(
    "building",
    !!document.querySelector(".build-experience"),
  );
  mountPreview();
}
function home() {
  const saved = localStorage.getItem("boardroom:last");
  return `<section class="home-grid"><div class="home-copy"><div class="eyebrow">THE CLASSROOM PC MARKET</div><h1>Your budget.<br>Your priorities.<br><em>Better business.</em></h1><p class="lead">Choose your budget. Build your next PC.<br>Can three sellers figure out what you want?</p><div class="steps"><span><b>01</b> Choose</span><span><b>02</b> Build</span><span><b>03</b> Discover</span></div></div><div class="hero-art"><img src="${import.meta.env.BASE_URL}hero.webp" alt="Playful purple PC, components, gold INR and a green reaction button" width="1200" height="800"></div><section class="entry card"><div class="tabs">${btn("Join the class", "join-tab", entry === "join" ? "active" : "ghost")}${btn("Present a session", "host-tab", entry === "host" ? "active" : "ghost")}</div>${entry === "join" ? `<h2>${invite ? "Your shop starts here." : "Your next PC starts here."}</h2><p>${invite ? "You are joining one of the three seller places." : "Scan the classroom QR or enter your room code."}</p><form id="join-form"><label>Your name<input id="name" name="name" required maxlength="24" autocomplete="nickname" placeholder="Name + initial"></label><label>Room code<input id="room" name="room" required maxlength="6" minlength="6" value="${esc(roomParam)}" placeholder="ABC234" autocapitalize="characters" style="text-transform:uppercase"></label><button class="button primary" ${busy ? "disabled" : ""}>${invite ? "Join as a seller" : "Let’s play"} <span>↗</span></button></form>` : `<h2>Bring the market to life.</h2><p>Create a room, project the customer QR, then invite three sellers after the budget survey.</p>${btn("Create a classroom", "create", "primary")}<p class="fine">No account needed. No customer-count cap. Rooms last 24 hours. Keep this browser open as your presenter control.</p>`}${saved && !roomParam ? btn("Resume room " + esc(saved), "resume-last", "ghost small") : ""}</section></section><section class="how-grid"><article><span class="number">01</span><h3>What would you spend?</h3><p>Choose your spending range in INR, then the components you value.</p></article><article><span class="number">02</span><h3>Build what you value.</h3><p>Mix parts from three shops. Performance, looks or value—you choose.</p></article><article><span class="number">03</span><h3>Know more. Decide better.</h3><p>Two markets, the same budgets. Round two gives sellers anonymous customer insights.</p></article></section>`;
}
function title(kicker, title, subtitle = "") {
  return `<div class="page-title"><div class="eyebrow">${kicker}</div><h1>${title}</h1>${subtitle ? `<p class="lead">${subtitle}</p>` : ""}</div>`;
}
function stats(items) {
  return `<div class="stats">${items.map(([n, t]) => `<div><strong>${n}</strong><span>${t}</span></div>`).join("")}</div>`;
}
function qr(url, label) {
  const cached = qrCache.get(url);
  return `<div class="qr-wrap"><div class="qr" data-url="${esc(url)}">${cached ? `<img src="${cached}" alt="${esc(label)} QR code" width="240" height="240">` : "Creating QR…"}</div><p>${label}</p><button class="button small ghost" data-copy="${esc(url)}">Copy invite link</button></div>`;
}
async function renderQRs() {
  for (const el of document.querySelectorAll(".qr[data-url]")) {
    const url = el.dataset.url;
    if (!qrCache.has(url)) {
      const src = await QRCode.toDataURL(url, {
        width: 640,
        margin: 3,
        errorCorrectionLevel: "M",
        color: { dark: "#252343", light: "#FFFFFF" },
      });
      qrCache.set(url, src);
      if (el.isConnected)
        el.innerHTML = `<img src="${src}" alt="Scan to join" width="240" height="240">`;
    }
  }
}
function host() {
  const c = state.counts;
  const customerURL =
    location.origin + location.pathname + "?room=" + state.code;
  const sellerURL =
    customerURL +
    "&seller=" +
    encodeURIComponent(client.invites[sellerQR] || "");
  let center = "";
  if (state.phase === "lobby")
    center = `<div class="host-grid"><section class="card qr-card"><h2>Everyone except the three sellers</h2>${qr(customerURL, "Scan to join as a customer")}<div class="room-code">${state.code}</div><p>Enter a name. Leave this screen open.</p></section><section><h2>Run your classroom market.</h2><ol class="run-list"><li>Customers join and choose a spending range in INR.</li><li>They privately choose their PC preferences.</li><li>Invite three sellers using their separate QR codes.</li><li>Run the first market with no customer insights.</li><li>Reveal anonymous insights. Repeat with the same budgets.</li></ol><p class="note">Individual budget answers stay private. Customer joining closes when you start the survey.</p></section></div>`;
  else if (state.phase === "reaction")
    center = `<section class="card"><h2>The class is choosing its budgets.</h2><p>Advance whenever you are ready; unfinished responses do not block the session. Customers choose their PC priorities after selecting a budget.</p>${stats(
      [
        [`${c.earned}/${c.customers}`, "budgets selected"],
        [`${c.preferences}/${c.customers}`, "preferences saved"],
      ],
    )}<p class="note">If you move on early, unanswered budgets are excluded from the survey totals.</p></section>`;
  else if (state.phase === "plan1")
    center = `<div class="host-grid"><section class="card qr-card"><h2>Invite the three sellers</h2><div class="tabs">${[0, 1, 2].map((n) => btn("Seller " + (n + 1), "seller-qr-" + n, sellerQR === n ? "active" : "ghost")).join("")}</div>${qr(sellerURL, "Seller " + (sellerQR + 1) + " · one person per invitation")}<p class="fine">Display each QR to its seller. Claimed invitations cannot create another seat.</p></section><section class="card"><h2>Let them make their guesses.</h2><p>Each seller chooses which components to offer and sets prices. Every offered component has unlimited supply.</p><p>Profit is the margin earned on actual sales. There are no inventory costs or supply shortages.</p>${sellerList()}<p class="note">Sellers see neither customer budgets nor preferences in round one.</p></section></div>`;
  else if (state.phase.startsWith("shop"))
    center = `<section class="card"><h2>The market is open.</h2>${stats([
      [`${c.finished}/${c.customers}`, "customers finished"],
      [state.round, "market round"],
    ])}<p>Customers can mix parts from all three shops. Every completed purchase contains five parts. They may also keep their money and pass.</p></section>`;
  else if (state.phase === "plan2")
    center = `<section class="card"><h2>Now the customer is in the boardroom.</h2><p>Sellers can see anonymous budget bands, intended uses and the components customers wanted. They can revise their offers and prices. Customers keep their original budget and wishlist.</p>${sellerList()}</section>${insightPanel()}`;
  if (
    state.phase === "result1" ||
    state.phase === "final" ||
    state.phase === "ended"
  )
    center += results();
  const nextNames = {
    lobby: "Start the budget survey",
    reaction: "Finish survey · invite sellers",
    plan1: "Open market one",
    shop1: "Close market · show results",
    result1: "Reveal insights · plan round two",
    plan2: "Open market two",
    shop2: "Finish · compare both rounds",
  };
  return (
    title("PRESENTER · ROOM " + state.code, PHASE_LABELS[state.phase]) +
    stats([
      [c.customers, "customers joined"],
      [`${c.sellers}/3`, "sellers joined"],
      [`${c.shopsReady}/3`, "shops ready"],
    ]) +
    center +
    `<section class="host-controls">${nextNames[state.phase] ? btn(nextNames[state.phase], "next", "primary") : btn("Play again with this class", "again", "primary")}${state.phase !== "ended" ? btn("End session…", "end", "ghost small") : ""}</section><details class="card roster"><summary>Classroom attendance & progress</summary>${(state.roster || []).map((p) => `<div><span>${esc(p.name)} <small>${p.role}</small></span><span>${p.role === "customer" ? (p.earned ? "Budget ✓ " : "") + (p.preferences ? "Preferences ✓ " : "") + (p.done ? "Finished ✓" : "") : p.ready ? "Shop ready ✓" : ""}</span></div>`).join("")}</details>`
  );
}
function sellerList() {
  return `<div class="seller-list">${state.sellers.map((p) => `<div><span>${esc(p.name)}</span>${pill(p.ready ? "Ready" : "Planning")}</div>`).join("") || "<p>Waiting for your three sellers…</p>"}</div>`;
}
function customer() {
  const p = state.me;
  if (state.phase === "lobby")
    return (
      title(
        "YOU’RE IN · ROOM " + state.code,
        `Hey, ${esc(p.name)}.`,
        "Your next PC starts with your budget.",
      ) +
      `<section class="waiting card"><img class="mini-art" src="${import.meta.env.BASE_URL}hero.webp" alt="Colorful PC setup"><h2>Waiting for the presenter</h2><p>Keep this page open. You’ll choose your spending range, then build your PC.</p>${pill(state.counts.customers + " customers are here")}</section>`
    );
  if (state.phase === "reaction") return reactionScreen();
  if (state.phase === "shop1" || state.phase === "shop2") return market();
  if (
    state.phase === "final" ||
    state.phase === "result1" ||
    state.phase === "ended"
  )
    return (
      title(
        "YOUR MARKET RESULTS",
        state.phase === "result1"
          ? "One market down."
          : "The decisions are in.",
      ) + results()
    );
  return (
    title(
      "YOUR BUDGET IS PRIVATE",
      `${money(p.budget)} INR. Your choices.`,
      state.phase === "plan2"
        ? "A fresh market is coming. Your original budget is restored."
        : "The three sellers are choosing their offers.",
    ) +
    `<section class="card"><h2>Your PC wishlist</h2><p>${esc(p.use)} · You can adjust what you actually buy when the market opens.</p>${buildList(p.wishlist)}<div class="note">${state.phase === "plan2" ? "Sellers now see anonymous budget bands and preferences. They cannot see your individual answer." : "Sellers do not know your budget or preferences yet."}</div></section>`
  );
}
function buildList(build) {
  return `<div class="build-list">${CATEGORIES.map((c) => `<div>${partImage(build[c], "summary-part-image")}<span><small>${LABELS[c]}</small><strong>${esc(BY_ID[build[c]]?.name || "Not selected")}</strong></span></div>`).join("")}</div>`;
}
function reactionScreen() {
  const p = state.me;
  if (!p.budgetChoice) {
    return `<section class="budget-survey"><div class="eyebrow">YOUR NEXT COMPUTER · INR</div><h1>How much would you spend on your next computer?</h1><img class="budget-hero" src="${import.meta.env.BASE_URL}hero.webp" alt="A complete desktop PC"><div class="budget-options">${BUDGET_OPTIONS.map((o, i) => `<button data-budget="${o.id}" class="component-option choice-${i % 3} ${budgetPick === o.id ? "selected" : ""}" aria-pressed="${budgetPick === o.id}"><b>${o.label}</b><span>${budgetPick === o.id ? "✓" : "→"}</span></button>`).join("")}</div><p>Your answer stays private in round one. Sellers see anonymous totals in round two.</p><button class="button primary" data-action="save-budget" ${!budgetPick || busy ? "disabled" : ""}>Next →</button></section>`;
  }
  if (prefKey !== p.id + ":" + p.budgetChoice) {
    prefKey = p.id + ":" + p.budgetChoice;
    wish = { ...p.wishlist };
    previewBuild = { ...wish };
    use = p.use;
    builderStep = 0;
  }
  return buildScreen("preferences");
}
function insightPanel() {
  const i = state.insights;
  if (!i) return "";
  const bars = (data) =>
    data
      .map(
        (x) =>
          `<div class="bar-row"><div><span>${esc(x.label || x.name)}</span><b>${x.count}</b></div><div class="bar-track"><span style="width:${i.count ? Math.round((x.count / i.count) * 100) : 0}%"></span></div></div>`,
      )
      .join("");
  return `<section class="insights"><div class="section-heading"><div class="eyebrow">THE CUSTOMER FILE</div><h2>Less guessing. More listening.</h2><p>Anonymous totals, not individual records. ${i.responses} of ${i.count} customers saved preferences.</p></div><div class="insight-grid"><article class="card"><h3>What they can spend</h3>${bars(i.bands)}</article><article class="card"><h3>What they’ll use it for</h3>${bars(i.uses)}</article>${CATEGORIES.map((c) => `<article class="card"><h3>${LABELS[c]} wishlist</h3>${bars(i.parts.filter((p) => p.category === c))}</article>`).join("")}</div><p class="fine">Wishlist demand is not a purchase commitment. Match preferences with affordability, and remember two other sellers are competing for the same customers.</p></section>`;
}
function seller() {
  const p = state.me;
  if (state.phase === "lobby" || state.phase === "reaction")
    return (
      title(
        "SELLER · " + esc(p.name),
        "Your market is coming.",
        "The class is choosing its budgets and preferences. Answers are private in round one.",
      ) +
      `<section class="card"><h2>Your job: make the most profit.</h2><p>Choose components and prices that customers want. Supply is unlimited; profit comes from the margin on each sale.</p></section>`
    );
  if (
    state.phase === "result1" ||
    state.phase === "final" ||
    state.phase === "ended"
  )
    return (
      title(
        "SELLER · " + esc(p.name),
        state.phase === "result1"
          ? "What did the market tell you?"
          : "Did knowing more change your business?",
      ) + results()
    );
  if (state.phase.startsWith("shop"))
    return (
      title(
        "SELLER · " + esc(p.name),
        "Your shop is open.",
        "Offers and prices are locked for this market.",
      ) +
      stats([
        [money(state.myStats.revenue), "revenue"],
        [money(state.myStats.profit), "profit / loss"],
        [state.myStats.sold, "components sold"],
      ]) +
      `<section class="card"><h2>Live sales</h2>${Object.values(
        state.offers[p.id] || {},
      )
        .filter(offerEnabled)
        .map(
          (o) =>
            `<div class="stock-line"><span>${BY_ID[o.part].name}</span><span>${o.sold} sold · ${money(o.price)} INR</span></div>`,
        )
        .join(
          "",
        )}<p class="note">Profit = revenue − the cost of components actually sold. Supply is unlimited.</p></section>`
    );
  const key = state.round + ":" + p.id;
  if (shopKey !== key) {
    shopKey = key;
    draftShop = Object.fromEntries(
      PARTS.map((x) => [
        x.id,
        {
          part: x.id,
          price: state.offers[p.id]?.[x.id]?.price || Math.round(x.cost * 1.5),
          enabled: state.offers[p.id]?.[x.id]
            ? offerEnabled(state.offers[p.id][x.id])
            : x.tier === 2,
        },
      ]),
    );
  }
  for (const c of CATEGORIES)
    if (!draftShop[previewBuild[c]]?.enabled)
      previewBuild[c] =
        PARTS.find((p) => p.category === c && draftShop[p.id]?.enabled)?.id ||
        c + "1";
  return (
    (state.round === 2
      ? `<details class="customer-insight-toggle"><summary>View anonymous customer insights ↗</summary>${insightPanel()}</details>`
      : "") + buildScreen("seller")
  );
}
function buildScreen(mode) {
  return builderScreen({
    mode,
    state,
    step: builderStep,
    preview: previewBuild,
    wish,
    use,
    cart,
    draftShop,
    busy,
  });
}
function market() {
  const p = state.me;
  if (p.done)
    return (
      title(
        "PURCHASE COMPLETE",
        state.order ? "Your PC is yours." : "You kept your money.",
        "Wait for the presenter to close the market.",
      ) +
      `<section class="card">${state.order ? buildList(Object.fromEntries(state.order.lines.map((l) => [BY_ID[l.part].category, l.part]))) : "<h2>No purchase this round.</h2>"}${stats(
        [
          [money(state.order?.total || 0), "spent (INR)"],
          [money(p.budget - (state.order?.total || 0)), "remaining (INR)"],
        ],
      )}<p>${state.round === 1 ? "Your original budget will return for round two." : "Both markets are complete. The results are next."}</p></section>`
    );
  return buildScreen("customer");
}
function cartTotal() {
  return Object.values(cart).reduce(
    (n, l) => n + linePrice(state,l),
    0,
  );
}
function results() {
  const rs = state.results,
    final = !!rs[2];
  return `<section class="results"><div class="section-heading"><h2>${final ? "Did insight improve profit?" : "The first market, by the numbers."}</h2><p>${final ? "Same customers. Same budgets. Unlimited supply. Compare what actually happened." : "Prices, offered components and customer choices all shaped this result."}</p></div><div class="result-grid">${state.sellers
    .map((s) => {
      const a = rs[1]?.sellers.find((x) => x.id === s.id),
        b = rs[2]?.sellers.find((x) => x.id === s.id);
      return `<article class="card result-card"><span class="eyebrow">${esc(s.name)}</span><h3>${money((b || a)?.profit)} <small>profit (INR)</small></h3>${a ? `<div class="stock-line"><span>Round 1 · blind</span><b>${money(a.profit)}</b></div>` : ""}${b ? `<div class="stock-line"><span>Round 2 · informed</span><b>${money(b.profit)}</b></div><div class="profit-change ${b.profit - a.profit >= 0 ? "positive" : "negative"}">${b.profit >= a.profit ? "+" : ""}${money(b.profit - a.profit)} change</div>` : ""}<p class="fine">${(b || a)?.sold || 0} parts sold in ${b ? "round 2" : "round 1"}</p></article>`;
    })
    .join("")}</div>${Object.entries(rs)
    .map(
      ([r, x]) =>
        `<p class="result-summary">Round ${r}: <b>${x.buyers}/${x.totalCustomers}</b> customers bought a complete PC. <b>${x.matchedParts}</b> purchased parts matched their original wishlists.</p>`,
    )
    .join(
      "",
    )}<section class="discussion card"><div class="eyebrow">ASK THE ROOM</div><h2>${final ? "Which decision changed because you understood the customer?" : "What did you assume—and what surprised you?"}</h2><p>${final ? "Better information can improve decisions, but it does not guarantee more profit. Competition, component choices, prices and learning from the first round also matter." : "Did you offer what people wanted, at prices they could afford? What would you want to know before making your next offer?"}</p>${final ? "<p>Compare total market profit as well as individual winners. This classroom experiment illustrates a mechanism; it is not proof that information alone caused the change.</p>" : ""}</section></section>`;
}
function ask(message) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "confirm-dialog";
    d.innerHTML =
      "<form method=dialog><h2>Confirm your choice</h2><p>" +
      esc(message) +
      "</p><div><button class=button value=no>Go back</button><button class=" +
      String.fromCharCode(34) +
      "button primary" +
      String.fromCharCode(34) +
      " value=yes>Confirm</button></div></form>";
    document.body.append(d);
    d.addEventListener(
      "close",
      () => {
        const yes = d.returnValue === "yes";
        d.remove();
        resolve(yes);
      },
      { once: true },
    );
    d.showModal();
  });
}
function render() {
  document.body.classList.toggle("scan-entry", !!roomParam && !state);
  shell(
    !state
      ? home()
      : state.me.role === "host"
        ? host()
        : state.me.role === "seller"
          ? seller()
          : customer(),
  );
}
async function task(fn) {
  if (busy) return;
  busy = true;
  error = "";
  try {
    await fn();
  } catch (e) {
    error = e.message;
  } finally {
    busy = false;
    render();
  }
}
root.addEventListener("input", (e) => {
  if (e.target.dataset.field) {
    draftShop[e.target.dataset.part][e.target.dataset.field] = Number(
      e.target.dataset.field === "price"
        ? Number(e.target.value) / 100
        : e.target.value,
    );
    const margin = document.querySelector("#unit-margin");
    if (margin)
      margin.textContent = money(
        Number(e.target.value) / 100 - BY_ID[e.target.dataset.part].cost,
      );
  }
  if (e.target.dataset.wish) wish[e.target.dataset.wish] = e.target.value;
  if (e.target.id === "use") use = e.target.value;
});
root.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "join-form") {
    const f = new FormData(e.target);
    task(async () => {
      const code = await client.enter(
        String(f.get("room")).trim().toUpperCase(),
        String(f.get("name")),
        invite,
      );
      history.replaceState(null, "", location.pathname + "?room=" + code);
    });
  }
  if (e.target.id === "preferences")
    task(() => client.act("PREFERENCES", { wishlist: wish, use }));
});
root.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.copy) {
    navigator.clipboard
      .writeText(b.dataset.copy)
      .then(() => {
        b.textContent = "Copied ✓";
      })
      .catch(() => {
        error = "Copy this link: " + b.dataset.copy;
        render();
      });
    return;
  }
  if (b.dataset.budget) {
    budgetPick = b.dataset.budget;
    render();
    return;
  }
  if (b.dataset.step !== undefined) {
    builderStep = Number(b.dataset.step);
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (b.dataset.component) {
    const id = b.dataset.component,
      c = BY_ID[id].category;
    previewBuild[c] = id;
    if (b.dataset.mode === "seller")
      for (const p of PARTS.filter((p) => p.category === c))
        draftShop[p.id].enabled = p.id === id;
    if (b.dataset.mode === "preferences") {
      const amount =
        Object.entries(wish).reduce(
          (n, [cat, p]) => n + (cat === c ? 0 : referencePrice(BY_ID[p])),
          0,
        ) + referencePrice(BY_ID[id]);
      if (amount > state.me.budget) return;
      wish[c] = id;
    }
    if (b.dataset.mode === "customer") {
      const o = cheapestOffer(state, id);
      if (o) cart[c] = { seller: o.seller, part: id };
    }
    render();
    return;
  }
  if (b.dataset.select) {
    cart[b.dataset.select] = { seller: b.dataset.seller, part: b.dataset.part };
    render();
    return;
  }
  const a = b.dataset.action;
  if (!a) return;
  if (a === "save-budget") {
    task(() => client.act("SELECT_BUDGET", { choice: budgetPick }));
    return;
  }
  if (a === "builder-next" || a === "builder-back") {
    builderStep = Math.max(
      0,
      Math.min(5, builderStep + (a === "builder-next" ? 1 : -1)),
    );
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (a === "save-preferences") {
    task(() => client.act("PREFERENCES", { wishlist: wish, use }));
    return;
  }
  if (a === "join-tab" || a === "host-tab") {
    entry = a === "join-tab" ? "join" : "host";
    render();
    return;
  }
  if (a === "dismiss") {
    error = "";
    render();
    return;
  }
  if (a.startsWith("seller-qr-")) {
    sellerQR = Number(a.slice(-1));
    render();
    return;
  }
  if (a === "create")
    task(async () => {
      const code = await client.enter();
      history.replaceState(null, "", location.pathname + "?room=" + code);
    });
  if (a === "resume-last")
    task(async () => {
      const c = localStorage.getItem("boardroom:last");
      await client.restore(c);
      history.replaceState(null, "", location.pathname + "?room=" + c);
    });
  if (a === "next") task(() => client.act("NEXT"));
  if (
    a === "force-next" &&
    (await ask(
      "Move to the next phase even if some people have not finished? Unanswered budgets are excluded from survey totals; unsaved shops remain empty.",
    ))
  )
    task(() => client.act("NEXT", { force: true }));
  if (a === "save-shop")
    task(() => client.act("SAVE_SHOP", { offers: Object.values(draftShop) }));
  if (
    a === "buy" &&
    (await ask(
      "Buy this complete PC for " +
        money(cartTotal()) +
        " INR? Purchases are final for this round.",
    ))
  )
    task(() => client.act("BUY", { lines: Object.values(cart) }));
  if (
    a === "pass" &&
    (await ask("Keep your INR and make no purchase this round?"))
  )
    task(() => client.act("PASS"));
  if (a === "end" && (await ask("End this session now?")))
    task(() => client.act("FORCE_END"));
  if (
    a === "again" &&
    (await ask(
      "Reset both markets and budget answers for everyone in this room?",
    ))
  )
    task(async () => {
      shopKey = "";
      prefKey = "";
      await client.act("PLAY_AGAIN");
    });
});
async function recover() {
  if (!client.credential || document.hidden) return;
  try {
    await client.refresh();
    await client.connect();
  } catch (e) {
    error = e.message;
    render();
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && reaction) {
    clearTimeout(reactTimer);
    reaction = null;
    lastTrial = "The attempt was interrupted. Continue to record it.";
  }
  if (!document.hidden) recover();
});
window.addEventListener("online", recover);
window.addEventListener("offline", () => {
  status = "Offline · reconnect before playing";
  render();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) recover();
});
render();
if (roomParam && localStorage.getItem("boardroom:" + roomParam))
  task(() => client.restore(roomParam));
