import { PARTS, BY_ID, CATEGORIES, LABELS, blankBuild } from "./game.js";
export const QUESTIONS = {
  cpu: "What will power your PC?",
  gpu: "How much graphics power do you want?",
  ram: "How much memory do you need?",
  ssd: "How much storage feels right?",
  case: "What should your PC look like?",
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => Number(n || 0).toLocaleString("en-IN");
export const partImage = (id, cls = "") =>
  `<img class="${cls}" src="${import.meta.env.BASE_URL}parts/${id}.webp" alt="${esc(BY_ID[id]?.name || "PC component")}" width="360" height="360">`;
export function cheapestOffer(state, part) {
  const offers = state.sellers
    .map((s) => ({ seller: s.id, name: s.name, ...state.offers[s.id]?.[part] }))
    .filter((o) => o.part && o.stock > o.sold)
    .sort((a, b) => a.price - b.price || a.seller.localeCompare(b.seller));
  if (!offers.length) return null;
  const best = offers.filter((o) => o.price === offers[0].price),
    seed = [...state.me.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return best[seed % best.length];
}
export function previewMarkup(build, active) {
  return `<div class="machine-stage"><div class="machine-badge"><span></span> YOUR PC · LIVE PREVIEW</div><div id="rig-view" data-build='${JSON.stringify(build)}' data-active="${active}"></div><div class="component-focus">${partImage(build[active] || build.case || "case1")}<span><small>${active === "review" ? "YOUR BUILD" : LABELS[active] + " · HIGHLIGHTED"}</small><b>${esc(BY_ID[build[active]]?.name || "All components installed")}</b></span></div><div class="machine-caption">${active === "review" ? "Your finished build" : "Tap an option to swap this part"}</div></div>`;
}
export function builderScreen({
  mode,
  state,
  step,
  preview,
  wish,
  use,
  cart,
  draftShop,
  busy,
}) {
  const seller = mode === "seller",
    prefs = mode === "preferences",
    review = step === 5,
    c = CATEGORIES[Math.min(step, 4)],
    build = {
      ...blankBuild(),
      ...preview,
      ...(prefs ? wish : {}),
      ...(!seller && !prefs
        ? Object.fromEntries(
            Object.entries(cart).map(([cat, o]) => [cat, o.part]),
          )
        : {}),
    };
  if (preview[c]) build[c] = preview[c];
  const total = Object.values(cart).reduce(
      (a, l) => a + (state.offers[l.seller]?.[l.part]?.price || 0),
      0,
    ),
    investment = PARTS.reduce(
      (a, p) => a + (draftShop[p.id]?.stock || 0) * p.cost,
      0,
    );
  const budget = seller ? state.capital : state.me.budget;
  const badge = seller
    ? "SELLER · ROUND " + state.round
    : prefs
      ? "YOUR PRIVATE WISHLIST"
      : "MARKET · ROUND " + state.round;
  let question = review
    ? seller
      ? "Ready to open your shop?"
      : prefs
        ? "Is this your kind of PC?"
        : "Ready to make it yours?"
    : seller
      ? "Which " + LABELS[c].toLowerCase() + " will you stock?"
      : QUESTIONS[c];
  let choices = "";
  if (review) {
    choices = `<div class="build-review">${
      seller
        ? PARTS.filter((p) => draftShop[p.id]?.stock)
            .map(
              (p) =>
                `<div>${partImage(p.id)}<span><b>${p.name}</b><small>${draftShop[p.id].stock} in stock · ${money(draftShop[p.id].price)} coins each</small></span></div>`,
            )
            .join("") || "<p>Your shop is empty. Go back and choose stock.</p>"
        : CATEGORIES.map(
            (cat) =>
              `<button data-step="${CATEGORIES.indexOf(cat)}" class="review-part">${partImage(build[cat])}<span><small>${LABELS[cat]}</small><b>${BY_ID[build[cat]].name}</b></span><span>Change ↗</span></button>`,
          ).join("")
    }</div>${prefs ? `<label class="purpose-label">What will you use it for?<select id="use">${["Everyday work", "Gaming", "Creative work", "Coding"].map((x) => `<option ${x === use ? "selected" : ""}>${x}</option>`).join("")}</select></label>` : ""}`;
  } else
    choices = `<div class="kahoot-choices">${PARTS.filter(
      (p) => p.category === c,
    )
      .map((p, i) => {
        const offer = !seller && !prefs ? cheapestOffer(state, p.id) : null;
        const selected = seller
          ? build[c] === p.id
          : prefs
            ? wish[c] === p.id
            : cart[c]?.part === p.id;
        const missing = !seller && !prefs && !offer;
        return `<button class="component-option choice-${i} ${selected ? "selected" : ""}" data-component="${p.id}" data-mode="${mode}" ${missing || busy ? "disabled" : ""} aria-pressed="${selected}">${partImage(p.id)}<span><b>${p.name}</b><small>${seller ? "Wholesale " + money(p.cost) + " coins" : prefs ? p.detail : offer ? money(offer.price) + " coins · " + esc(offer.name) : "Not stocked by any shop"}</small></span><span class="choice-check">${selected ? "✓" : ["A", "B", "C"][i]}</span></button>`;
      })
      .join("")}</div>`;
  if (seller && !review) {
    const picked = BY_ID[build[c]],
      d = draftShop[picked.id];
    choices += `<div class="stock-editor"><div><b>${picked.name}</b><small>Set stock and price. You may stock multiple options.</small></div><label>Selling price<input type="number" inputmode="numeric" min="${picked.cost}" max="10000" data-part="${picked.id}" data-field="price" aria-label="${picked.name} selling price" value="${d.price}"></label><label>Quantity<input type="number" inputmode="numeric" min="0" max="${state.counts.customers}" data-part="${picked.id}" data-field="stock" aria-label="${picked.name} stock quantity" value="${d.stock}"></label></div>`;
  }
  const amount = seller ? investment : prefs ? budget : total;
  const action = review
    ? seller
      ? "save-shop"
      : prefs
        ? "save-preferences"
        : "buy"
    : "builder-next";
  const buttonText = review
    ? seller
      ? state.me.ready
        ? "Update my shop"
        : "Save & ready my shop"
      : prefs
        ? "Save my preferences"
        : "Buy my PC"
    : step === 4
      ? "Review my " + (seller ? "shop" : "PC")
      : "Next →";
  const disabled =
    busy ||
    (!review && !seller && !prefs && !cart[c]) ||
    (review &&
      !seller &&
      !prefs &&
      (Object.keys(cart).length !== 5 || total > budget));
  return `<section class="build-experience"><div class="build-topline"><span>${badge}</span><span>${seller ? "Capital" : prefs ? "Income" : "Budget"} <b>${money(budget)}</b> coins</span></div><nav class="build-progress" aria-label="PC build steps">${CATEGORIES.map((cat, i) => `<button data-step="${i}" class="${i === step ? "current" : ""} ${i < step ? "visited" : ""}" aria-label="Step ${i + 1}: ${LABELS[cat]}"><span>${i + 1}</span><small>${["CPU", "Graphics", "RAM", "Storage", "Case"][i]}</small></button>`).join("")}<button data-step="5" class="${review ? "current" : ""}" aria-label="Review build"><span>✓</span><small>Review</small></button></nav><h1 class="build-question">${question}</h1>${previewMarkup(build, review ? "review" : c)}<div class="choice-area">${choices}</div><div class="build-bottom"><button class="button ghost" data-action="builder-back" ${step === 0 ? "disabled" : ""}>← Back</button><div><small>${seller ? "Stock investment" : prefs ? "Private income" : "Build total"}</small><strong id="investment">${money(amount)}${prefs ? "" : " / " + money(budget)}</strong></div><button class="button primary" data-action="${action}" ${disabled ? "disabled" : ""}>${buttonText}</button></div>${!seller && !prefs ? '<p class="builder-footnote">Best available shop price shown for each option. You may mix sellers. <button data-action="pass">Pass this market</button></p>' : seller ? `<p class="builder-footnote">${state.me.ready ? "Shop saved ✓ · changes need to be saved again." : "Profit = sales − all inventory costs, including unsold parts."}</p>` : state.me.preferenceSaved ? '<p class="builder-footnote success">Preferences saved ✓ · waiting for the presenter.</p>' : ""}</section>`;
}
export async function mountPreview() {
  const el = document.getElementById("rig-view");
  if (!el) return;
  const build = JSON.parse(el.dataset.build),
    active = el.dataset.active;
  const { mountRig } = await import("./rig.js");
  if (el.isConnected) mountRig(el, build, active);
}
