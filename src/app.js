import "./styles.css";
import QRCode from "qrcode";
import { RoomClient } from "./network.js";
import {
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
const money = (n) => Number(n || 0).toLocaleString("en-IN");
const icon = (name) =>
  ({ cpu: "◈", gpu: "▣", ram: "▤", ssd: "▰", case: "▥" })[name] || "◆";
const client = new RoomClient(
  (s) => {
    const was = state;
    state = s;
    if (was?.phase !== s.phase) {
      cart = {};
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
          s.me.trials.length === 5));
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
}
function home() {
  const saved = localStorage.getItem("boardroom:last");
  return `<section class="home-grid"><div class="home-copy"><div class="eyebrow">THE CLASSROOM PC MARKET</div><h1>Quick hands.<br>Smart builds.<br><em>Better business.</em></h1><p class="lead">Earn your income. Build your dream PC.<br>Can three sellers figure out what you want?</p><div class="steps"><span><b>01</b> React</span><span><b>02</b> Build</span><span><b>03</b> Discover</span></div></div><div class="hero-art"><img src="${import.meta.env.BASE_URL}hero.webp" alt="Playful purple PC, components, gold coins and a green reaction button" width="1200" height="800"></div><section class="entry card"><div class="tabs">${btn("Join the class", "join-tab", entry === "join" ? "active" : "ghost")}${btn("Present a session", "host-tab", entry === "host" ? "active" : "ghost")}</div>${entry === "join" ? `<h2>${invite ? "Your shop starts here." : "Your next PC starts here."}</h2><p>${invite ? "You are joining one of the three seller places." : "Scan the classroom QR or enter your room code."}</p><form id="join-form"><label>Your name<input id="name" name="name" required maxlength="24" autocomplete="nickname" placeholder="Name + initial"></label><label>Room code<input id="room" name="room" required maxlength="6" minlength="6" value="${esc(roomParam)}" placeholder="ABC234" autocapitalize="characters" style="text-transform:uppercase"></label><button class="button primary" ${busy ? "disabled" : ""}>${invite ? "Join as a seller" : "Let’s play"} <span>↗</span></button></form>` : `<h2>Bring the market to life.</h2><p>Create a room, project the customer QR, then invite three sellers after the income challenge.</p>${btn("Create a classroom", "create", "primary")}<p class="fine">No account needed. No customer-count cap. Rooms last 24 hours. Keep this browser open as your presenter control.</p>`}${saved && !roomParam ? btn("Resume room " + esc(saved), "resume-last", "ghost small") : ""}</section></section><section class="how-grid"><article><span class="number">01</span><h3>Income has a pulse.</h3><p>Five green-light taps earn your budget. Under 200 ms, rewards rise exponentially.</p></article><article><span class="number">02</span><h3>Build what you value.</h3><p>Mix parts from three shops. Performance, looks or value—you choose.</p></article><article><span class="number">03</span><h3>Know more. Decide better.</h3><p>Two markets, the same budgets. Round two gives sellers anonymous customer insights.</p></article></section>`;
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
    center = `<div class="host-grid"><section class="card qr-card"><h2>Everyone except the three sellers</h2>${qr(customerURL, "Scan to join as a customer")}<div class="room-code">${state.code}</div><p>Enter a name. Leave this screen open.</p></section><section><h2>Run your classroom market.</h2><ol class="run-list"><li>Customers join and play five reaction attempts.</li><li>They privately choose their PC preferences.</li><li>Invite three sellers using their separate QR codes.</li><li>Run the first market with no customer insights.</li><li>Reveal anonymous insights. Repeat with the same budgets.</li></ol><p class="note">No reaction averages or scores appear on seller screens. Customer joining closes when you start the challenge.</p></section></div>`;
  else if (state.phase === "reaction")
    center = `<section class="card"><h2>The class is earning its buying power.</h2><p>Wait for both progress counters to finish. Customers choose their own PC priorities after the five attempts.</p>${stats(
      [
        [`${c.earned}/${c.customers}`, "income earned"],
        [`${c.preferences}/${c.customers}`, "preferences saved"],
      ],
    )}<p class="note">If you move on early, unfinished customers receive 600 coins. Their default wishlist is included in the insight counts.</p></section>`;
  else if (state.phase === "plan1")
    center = `<div class="host-grid"><section class="card qr-card"><h2>Invite the three sellers</h2><div class="tabs">${[0, 1, 2].map((n) => btn("Seller " + (n + 1), "seller-qr-" + n, sellerQR === n ? "active" : "ghost")).join("")}</div>${qr(sellerURL, "Seller " + (sellerQR + 1) + " · one person per invitation")}<p class="fine">Display each QR to its seller. Claimed invitations cannot create another seat.</p></section><section class="card"><h2>Let them make their guesses.</h2><p>Each seller chooses components, quantities and selling prices. Their working capital is identical: <b>${money(state.capital)} coins</b>.</p><p>Unsold stock has no resale value in this experiment. Profit = sales revenue − all inventory purchased.</p>${sellerList()}<p class="note">Sellers see neither customer budgets nor preferences in round one.</p></section></div>`;
  else if (state.phase.startsWith("shop"))
    center = `<section class="card"><h2>The market is open.</h2>${stats([
      [`${c.finished}/${c.customers}`, "customers finished"],
      [state.round, "market round"],
    ])}<p>Customers can mix parts from all three shops. Every completed purchase contains five parts. They may also keep their coins and pass.</p></section>`;
  else if (state.phase === "plan2")
    center = `<section class="card"><h2>Now the customer is in the boardroom.</h2><p>Sellers can see anonymous budget bands, intended uses and the components customers wanted. They get fresh inventory and the same working capital. Customers keep their original income and wishlist.</p>${sellerList()}</section>${insightPanel()}`;
  if (
    state.phase === "result1" ||
    state.phase === "final" ||
    state.phase === "ended"
  )
    center += results();
  const nextNames = {
    lobby: "Start the reaction challenge",
    reaction: "Finish income · invite sellers",
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
    `<section class="host-controls">${nextNames[state.phase] ? btn(nextNames[state.phase], "next", "primary") : btn("Play again with this class", "again", "primary")}${nextNames[state.phase] ? btn("Move on early…", "force-next", "ghost") : ""}${state.phase !== "ended" ? btn("End session…", "end", "ghost small") : ""}</section><details class="card roster"><summary>Classroom attendance & progress</summary>${(state.roster || []).map((p) => `<div><span>${esc(p.name)} <small>${p.role}</small></span><span>${p.role === "customer" ? (p.earned ? "Income ✓ " : "") + (p.preferences ? "Preferences ✓ " : "") + (p.done ? "Finished ✓" : "") : p.ready ? "Shop ready ✓" : ""}</span></div>`).join("")}</details>`
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
        "Your next PC starts with a quick reaction.",
      ) +
      `<section class="waiting card"><img class="mini-art" src="${import.meta.env.BASE_URL}hero.webp" alt="Colorful PC setup"><h2>Waiting for the presenter</h2><p>Keep this page open. You’ll tap when the screen turns green, earn coins, then build your PC.</p>${pill(state.counts.customers + " customers are here")}</section>`
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
      `${money(p.budget)} coins. Your choices.`,
      state.phase === "plan2"
        ? "A fresh market is coming. Your original budget is restored."
        : "The three sellers are stocking their shops.",
    ) +
    `<section class="card"><h2>Your PC wishlist</h2><p>${esc(p.use)} · You can adjust what you actually buy when the market opens.</p>${buildList(p.wishlist)}<div class="note">${state.phase === "plan2" ? "Sellers now see anonymous budget bands and preferences. They still cannot see your reaction results." : "Sellers do not know your budget or preferences yet."}</div></section>`
  );
}
function buildList(build) {
  return `<div class="build-list">${CATEGORIES.map((c) => `<div><span class="part-symbol ${c}">${icon(c)}</span><span><small>${LABELS[c]}</small><strong>${esc(BY_ID[build[c]]?.name || "Not selected")}</strong></span></div>`).join("")}</div>`;
}
function reactionScreen() {
  const p = state.me;
  if (p.trials.length === 5) {
    if (prefKey !== p.id) {
      prefKey = p.id;
      wish = { ...p.wishlist };
      use = p.use;
    }
    return (
      title(
        "YOUR INCOME",
        `${money(p.budget)} coins earned.`,
        `Your median reaction: ${median(p.trials)} ms. This budget stays the same for both markets.`,
      ) +
      `<section class="card"><h2>What would you like your PC to do?</h2><p>This is your private wishlist, not a purchase. Pick what you value. The actual market may offer different prices and stock.</p><form id="preferences"><label>Main use<select name="use" id="use">${["Everyday work", "Gaming", "Creative work", "Coding"].map((n) => `<option ${n === use ? "selected" : ""}>${n}</option>`).join("")}</select></label><div class="preference-grid">${CATEGORIES.map(
        (c) =>
          `<label>${LABELS[c]}<select data-wish="${c}">${PARTS.filter(
            (p) => p.category === c,
          )
            .map(
              (p) =>
                `<option value="${p.id}" ${wish[c] === p.id ? "selected" : ""}>${p.name}</option>`,
            )
            .join("")}</select></label>`,
      ).join(
        "",
      )}</div><button class="button primary" ${busy ? "disabled" : ""}>${p.preferenceSaved ? "Update my preferences" : "Save my preferences"}</button></form>${p.preferenceSaved ? '<p class="success">Saved. Wait here for the market to open.</p>' : ""}</section>`
    );
  }
  return (
    title(
      `REACTION ${p.trials.length + 1} OF 5`,
      "Wait. Green. Tap.",
      "Five attempts. Your middle time sets your income.",
    ) +
    `<section class="reaction-card"><button id="reaction-pad" class="reaction-pad ${reaction?.phase || "idle"}" ${busy ? "disabled" : ""}><span class="signal">${reaction?.phase === "green" ? "●" : "○"}</span><strong>${reaction?.phase === "green" ? "TAP NOW" : reaction?.phase === "waiting" ? "Wait for green…" : p.challenge ? "Interrupted attempt" : "Ready when you are."}</strong><span>${reaction ? "Tap only after the color changes." : p.challenge ? "Tap to record this interrupted attempt and continue." : "Tap here to begin."}</span></button><p id="last-trial" aria-live="polite">${esc(lastTrial)}</p><div class="trial-dots">${Array.from({ length: 5 }, (_, i) => `<span class="${i < p.trials.length ? "complete" : ""}">${i < p.trials.length ? p.trials[i] + " ms" : i + 1}</span>`).join("")}</div></section><section class="reaction-info"><p><b>Too early?</b> That attempt counts as 2,000 ms. There are no restarts.</p><p><b>The reward curve:</b> 300 ms → ${money(coins(300))} coins · 200 ms → ${money(coins(200))} · 150 ms → ${money(coins(150))}.</p><p class="fine">Play on your own device. Timing uses your screen, not network round-trip speed. Device latency can affect results; this is a classroom simulation, not a scientific reflex test.</p></section>`
  );
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
        "The class is earning its income. Customer scores and budgets are private.",
      ) +
      `<section class="card"><h2>Your job: make the most profit.</h2><p>Stock PC parts, choose prices, and attract customers. You pay for everything you stock, including unsold parts.</p></section>`
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
        "Prices and quantities are locked for this market.",
      ) +
      stats([
        [money(state.myStats.revenue), "revenue"],
        [money(state.myStats.profit), "profit / loss"],
        [state.myStats.unsold, "parts still in stock"],
      ]) +
      `<section class="card"><h2>Live inventory</h2>${Object.values(
        state.offers[p.id] || {},
      )
        .filter((o) => o.stock)
        .map(
          (o) =>
            `<div class="stock-line"><span>${BY_ID[o.part].name}</span><span>${o.sold}/${o.stock} sold · ${money(o.price)} coins</span></div>`,
        )
        .join(
          "",
        )}<p class="note">Profit = revenue − all inventory cost. Unsold stock has zero recovery value.</p></section>`
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
          stock: state.offers[p.id]?.[x.id]?.stock || 0,
        },
      ]),
    );
  }
  return (
    title(
      `SELLER · ${esc(p.name)} · ROUND ${state.round}`,
      state.round === 1 ? "What will they want?" : "Now, make an informed bet.",
      `Stock a shop for ${state.counts.customers} customers. Your working capital is ${money(state.capital)} coins.`,
    ) +
    (state.round === 2
      ? insightPanel()
      : `<p class="note">Your first market is a blind decision. You have no customer income or preference data.</p>`) +
    `<section class="card"><div class="section-heading"><h2>Your component shop</h2><p>Choose quantities and prices. All five component categories are compatible. Cases include the motherboard, power supply and cooling.</p></div><div class="shop-columns"><span>Component · wholesale cost</span><span>Price</span><span>Stock</span></div>${CATEGORIES.map(
      (c) =>
        `<h3 class="category-heading">${LABELS[c]}</h3>${PARTS.filter(
          (x) => x.category === c,
        )
          .map(
            (x) =>
              `<div class="shop-row"><div><strong>${x.name}</strong><small>${money(x.cost)} coins each</small></div><label><span class="sr-only">${x.name} selling price</span><input inputmode="numeric" type="number" min="${x.cost}" max="10000" data-part="${x.id}" data-field="price" value="${draftShop[x.id].price}"></label><label><span class="sr-only">${x.name} stock quantity</span><input inputmode="numeric" type="number" min="0" max="${state.counts.customers}" data-part="${x.id}" data-field="stock" value="${draftShop[x.id].stock}"></label></div>`,
          )
          .join("")}`,
    ).join(
      "",
    )}<p class="fine">Keep prices at or above wholesale cost. You can stock up to one unit per customer of any component. There is no customer-count cap.</p></section><div class="sticky-action"><div><small>Inventory investment</small><strong id="investment">${money(investment())} / ${money(state.capital)}</strong></div>${btn(p.ready ? "Update my shop" : "Save & ready my shop", "save-shop", "primary")}${p.ready ? '<span class="success">Shop saved ✓</span>' : ""}</div>`
  );
}
function investment() {
  return PARTS.reduce(
    (n, p) => n + (Number(draftShop[p.id]?.stock) || 0) * p.cost,
    0,
  );
}
function market() {
  const p = state.me;
  if (p.done)
    return (
      title(
        "PURCHASE COMPLETE",
        state.order ? "Your PC is yours." : "You kept your coins.",
        "Wait for the presenter to close the market.",
      ) +
      `<section class="card">${state.order ? buildList(Object.fromEntries(state.order.lines.map((l) => [BY_ID[l.part].category, l.part]))) : "<h2>No purchase this round.</h2>"}${stats(
        [
          [money(state.order?.total || 0), "coins spent"],
          [money(p.budget - (state.order?.total || 0)), "coins left"],
        ],
      )}<p>${state.round === 1 ? "Your original budget will return for round two." : "Both markets are complete. The results are next."}</p></section>`
    );
  const total = cartTotal();
  return (
    title(
      `CUSTOMER · ROUND ${state.round}`,
      "Build your next PC.",
      `Your budget: ${money(p.budget)} coins. Choose one part in every category; mix shops however you like.`,
    ) +
    `<p class="note">Your preference: ${esc(p.use)}. Cases include the motherboard, power supply and cooling. Every combination works.</p><div class="market-grid">${CATEGORIES.map(
      (c) =>
        `<section class="component-section"><div class="section-heading"><span class="part-symbol ${c}">${icon(c)}</span><div><h2>${LABELS[c]}</h2><p>Wishlist: ${BY_ID[p.wishlist[c]].name}</p></div></div><div class="offers">${
          state.sellers
            .flatMap((seller) =>
              Object.values(state.offers[seller.id] || {})
                .filter((o) => BY_ID[o.part].category === c && o.stock > 0)
                .map((o) => {
                  const selected =
                    cart[c]?.seller === seller.id && cart[c]?.part === o.part;
                  return `<button class="offer ${selected ? "selected" : ""}" data-select="${c}" data-seller="${seller.id}" data-part="${o.part}" ${o.stock <= o.sold ? "disabled" : ""}><span class="offer-top"><span>${esc(seller.name)}</span>${selected ? "<b>✓ Selected</b>" : ""}</span><strong>${BY_ID[o.part].name}</strong><small>${BY_ID[o.part].detail}</small><span class="offer-bottom"><b>${money(o.price)} <small>coins</small></b><span>${o.stock - o.sold} left</span></span></button>`;
                }),
            )
            .join("") ||
          '<p class="empty">No seller stocked this category. You can wait, or pass this round.</p>'
        }</div></section>`,
    ).join(
      "",
    )}</div><div class="sticky-action"><div><small>${Object.keys(cart).length}/5 parts selected</small><strong>${money(total)} / ${money(p.budget)} coins</strong></div>${btn("Buy my PC", "buy", "primary", Object.keys(cart).length !== 5 || total > p.budget)}${btn("Pass this round", "pass", "ghost small")}</div>`
  );
}
function cartTotal() {
  return Object.values(cart).reduce(
    (n, l) => n + (state.offers[l.seller]?.[l.part]?.price || 0),
    0,
  );
}
function results() {
  const rs = state.results,
    final = !!rs[2];
  return `<section class="results"><div class="section-heading"><h2>${final ? "Did insight improve profit?" : "The first market, by the numbers."}</h2><p>${final ? "Same customers. Same income. Fresh inventory. Compare what actually happened." : "Prices, availability and customer choices all shaped this result."}</p></div><div class="result-grid">${state.sellers
    .map((s) => {
      const a = rs[1]?.sellers.find((x) => x.id === s.id),
        b = rs[2]?.sellers.find((x) => x.id === s.id);
      return `<article class="card result-card"><span class="eyebrow">${esc(s.name)}</span><h3>${money((b || a)?.profit)} <small>coins profit</small></h3>${a ? `<div class="stock-line"><span>Round 1 · blind</span><b>${money(a.profit)}</b></div>` : ""}${b ? `<div class="stock-line"><span>Round 2 · informed</span><b>${money(b.profit)}</b></div><div class="profit-change ${b.profit - a.profit >= 0 ? "positive" : "negative"}">${b.profit >= a.profit ? "+" : ""}${money(b.profit - a.profit)} change</div>` : ""}<p class="fine">${(b || a)?.sold || 0} parts sold · ${(b || a)?.unsold || 0} unsold in ${b ? "round 2" : "round 1"}</p></article>`;
    })
    .join("")}</div>${Object.entries(rs)
    .map(
      ([r, x]) =>
        `<p class="result-summary">Round ${r}: <b>${x.buyers}/${x.totalCustomers}</b> customers bought a complete PC. <b>${x.matchedParts}</b> purchased parts matched their original wishlists.</p>`,
    )
    .join(
      "",
    )}<section class="discussion card"><div class="eyebrow">ASK THE ROOM</div><h2>${final ? "Which decision changed because you understood the customer?" : "What did you assume—and what surprised you?"}</h2><p>${final ? "Better information can improve decisions, but it does not guarantee more profit. Competition, stock choices, prices and learning from the first round also matter." : "Did you stock what people wanted, at prices they could afford? What would you want to know before buying stock again?"}</p>${final ? "<p>Compare total market profit as well as individual winners. This classroom experiment illustrates a mechanism; it is not proof that information alone caused the change.</p>" : ""}</section></section>`;
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
async function tapReaction() {
  if (busy || !state || state.phase !== "reaction") return;
  if (!reaction) {
    if (state.me.challenge) {
      await task(() =>
        client.act("TRIAL_END", {
          nonce: state.me.challenge.nonce,
          ms: 2000,
          early: true,
        }),
      );
      lastTrial = "Interrupted attempt recorded as 2,000 ms.";
      render();
      return;
    }
    busy = true;
    try {
      await client.act("TRIAL_START");
      const ch = state.me.challenge;
      reaction = { phase: "waiting", nonce: ch.nonce };
      busy = false;
      render();
      reactTimer = setTimeout(
        () =>
          requestAnimationFrame(() => {
            if (!reaction) return;
            const pad = document.querySelector("#reaction-pad");
            reaction.phase = "green";
            pad.classList.remove("waiting");
            pad.classList.add("green");
            pad.querySelector(".signal").textContent = "●";
            pad.querySelector("strong").textContent = "TAP NOW";
            reaction.start = performance.now();
          }),
        ch.delay,
      );
    } catch (e) {
      busy = false;
      error = e.message;
      render();
    }
    return;
  }
  const early = reaction.phase !== "green",
    ms = early
      ? 2000
      : Math.min(2000, Math.round(performance.now() - reaction.start)),
    nonce = reaction.nonce;
  clearTimeout(reactTimer);
  reaction = null;
  lastTrial = early
    ? "Too early. This attempt counts as 2,000 ms."
    : `${ms} ms · ${state.me.trials.length === 4 ? "Income calculated." : "Ready for the next attempt."}`;
  await task(() => client.act("TRIAL_END", { nonce, ms, early }));
}
root.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#reaction-pad")) {
    e.preventDefault();
    tapReaction();
  }
});
root.addEventListener("keydown", (e) => {
  if (
    e.target.closest("#reaction-pad") &&
    (e.key === " " || e.key === "Enter")
  ) {
    e.preventDefault();
    if (!e.repeat) tapReaction();
  }
});
root.addEventListener("input", (e) => {
  if (e.target.dataset.field) {
    draftShop[e.target.dataset.part][e.target.dataset.field] = Number(
      e.target.value,
    );
    document.querySelector("#investment").textContent =
      money(investment()) + " / " + money(state.capital);
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
  if (b.dataset.select) {
    cart[b.dataset.select] = { seller: b.dataset.seller, part: b.dataset.part };
    render();
    return;
  }
  const a = b.dataset.action;
  if (!a) return;
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
      "Move to the next phase even if some people have not finished? Unfinished reaction players receive 600 coins; unsaved shops remain empty.",
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
        " coins? Purchases are final for this round.",
    ))
  )
    task(() => client.act("BUY", { lines: Object.values(cart) }));
  if (
    a === "pass" &&
    (await ask("Keep your coins and make no purchase this round?"))
  )
    task(() => client.act("PASS"));
  if (a === "end" && (await ask("End this session now?")))
    task(() => client.act("FORCE_END"));
  if (
    a === "again" &&
    (await ask(
      "Reset both markets and reaction scores for everyone in this room?",
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
