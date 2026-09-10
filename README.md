# Customer in the Boardroom

A live classroom experiment: reaction-earned income, PC shopping, and three sellers trying to understand their market.

## Run in class

1. Open the game on your projector. Choose **Present a session → Create a classroom**.
2. Everyone except the three sellers scans the customer QR. There is **no customer-count cap**. Names must be distinct. Joining closes when the presenter starts the reaction phase.
3. Start the reaction challenge. Each customer gets five attempts and taps when the screen turns green. Early or interrupted attempts count as 2,000 ms. The median sets income: `round(600 + 900 × exp((200 − median_ms) / 65))`, with times clamped to 80–2,000 ms. Sub-80 ms attempts are penalized. Everyone receives at least 600 coins.
4. Customers choose their intended PC use and private wishlist. Wait for both progress counters to finish.
5. Move to seller planning and show each of the three seller QR codes to exactly one seller. Each invitation claims one seat. Sellers have unlimited supply, with **no reaction scores, class average, customer budgets or preferences in round one**.
6. Sellers choose components to offer and set selling prices across five categories. All combinations are compatible. Cases include motherboard, PSU and cooling. Prices cannot fall below wholesale cost.
7. Open the market. Customers buy one complete five-part PC, mixing sellers, or pass. Purchases are final; the budget and selected offers are validated atomically.
8. Show round-one results. Advance to anonymous budget bands, intended uses and wishlist counts. No identities, individual budgets or reaction scores are exposed to sellers.
9. Sellers revise their offers and prices using anonymous customer insights. Customers have the **same original income and wishlist**. Run market two and compare profits, completion counts and wishlist matches.

**Profit = revenue − the cost of components actually sold.** Supply is unlimited. No inventory quantities, capital limits or unsold-stock penalties. Higher revenue alone is not higher profit. Better information does not guarantee a winner: competition, prices, component choices and learning also affect results. This is a teaching simulation, not a causal study or a standardized reflex test. Device input/display latency can affect income.

Suggested timing: 2 minutes joining, 2 minutes reaction/preferences, 3 minutes seller planning, 2 minutes shopping, 1 minute results, then 3 minutes informed planning and 2 minutes shopping. The presenter controls phases, can move on early, end a stalled session, or play again. Moving on early grants incomplete customers the 600-coin floor; their default wishlist is identified through response counts.

## Hosting and cost boundaries

- **Frontend:** GitHub Pages from this public repository, via `.github/workflows/pages.yml`.
- **Backend:** a new Vercel **Hobby** project, connected to this GitHub repository.
- **Database:** a separate Neon **Free (`free_v3`)** database. No existing project database is reused.
- **Cloudflare is not used or deployed.** No paid service, plan upgrade or billing change is required.
- Free hosting has provider limits. Rooms expire after 24 hours, streams rotate after 4 minutes and idle database compute can suspend. Expired records are removed on the next room creation; there are no scheduled keep-alive jobs.

## Architecture

`src/game.js` is the shared, deterministic action engine. `server/service.js` validates roles, phase, budgets, offers and requests. `server/store.js` stores private room state and hashed resume credentials in Neon Postgres. A revision compare-and-swap write and processed client action IDs prevent conflicting updates and duplicate purchases. Postgres LISTEN/NOTIFY triggers redacted per-seat SSE snapshots. HTTP actions and SSE use bearer credentials; shareable room codes are not credentials. A 20-second catch-up check only covers missed notifications. Live updates normally come directly from commits.

Only opaque resume credentials are stored in the player's browser. Refresh and connection recovery restore the existing seat. Keep the same browser/device; copying the public invite to another device does not transfer a claimed seat. Names are escaped. Origin restrictions, payload limits and rate limits are enforced. Customer private fields never go to seller browsers in round one.

## Develop

Node 22+:

```sh
npm ci
npm run dev:server
npm run dev
```

Local development uses durable test files under `.local-rooms/`, never client-only room state. To exercise Neon locally, use `node --env-file=.env.local server/local.js`. Production requires `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in Vercel environment settings. No database credential may be a `VITE_` variable or committed. Only `VITE_API_URL` is public.

```sh
npm test
npm run check
npm run build
node tests/live.mjs
```

`tests/game.test.js` covers scoring, privacy, uncapped joining, role limits, every action family, unlimited supply, budget checks, both rounds, Force End and Play Again. `tests/live.mjs` covers durable server actions, live observation, concurrent purchases, resume credentials and idempotency. Set `TEST_API` to target an authorized test deployment.

## Component/effect matrix

| Component / action             | Effect                                               | UI                                 | Verification                      |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------- | --------------------------------- |
| CPU/GPU/RAM/SSD/case × 3 tiers | Fixed unit cost, price and unlimited supply; one per build | Seller offers + customer market | data completeness, purchase tests |
| TRIAL_START / TRIAL_END        | Five attempts; median → income                       | Green reaction pad                 | timing and scoring tests          |
| PREFERENCES                    | Private use + wishlist                               | Customer selectors                 | role/phase validation             |
| SAVE_SHOP                      | Unlimited-supply offers                            | Seller editor                      | offer/profit tests               |
| BUY / PASS                     | Atomic purchase or decline                           | PC builder                         | race, duplicate, overspend tests  |
| NEXT                           | Presenter-only phase change                          | Presenter controls                 | full two-market test              |
| FORCE_END / PLAY_AGAIN         | End safely or reset                                  | Presenter controls                 | recovery tests                    |

Original hero artwork was generated for this project. Component specifications and coin prices are fictional classroom abstractions; no commercial campaign images or logos are used.
