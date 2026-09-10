import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createState, addPlayer, apply, view, assert } from "../src/game.js";
import { store } from "./store.js";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const allowed = (
  process.env.ALLOWED_ORIGINS ||
  "https://cyberpaapi.github.io,https://customer-boardroom.vercel.app,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173"
).split(",");
const send = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
};
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) throw Error("Request too large.");
  }
  return raw ? JSON.parse(raw) : {};
}
function identity(req, data) {
  const t = (req.headers.authorization || "").replace(/^Bearer /, "");
  const m = data.members[hash(t)];
  assert(m, "Your saved seat could not be verified. Rejoin the room.");
  return m.id;
}
export async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  if (origin && !allowed.includes(origin))
    return send(res, 403, { error: "Origin not allowed." });
  res.setHeader("Access-Control-Allow-Origin", origin || allowed[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  const u = new URL(req.url, "http://server"),
    route = (u.searchParams.get("route") || u.pathname).replace(/\/+$/, ""),
    code = route.split("/")[2],
    tail = route.split("/").pop();
  try {
    if (route === "/health")
      return send(res, 200, {
        ok: true,
        configured: !!process.env.DATABASE_URL || !!process.env.LOCAL_STORE_DIR,
        service: "customer-boardroom",
        transport: "sse",
        version: "1.0.0",
      });
    if (route === "/rooms") {
      assert(req.method === "POST", "Method not allowed.");
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket?.remoteAddress ||
        "unknown";
      assert(
        await store.limit("create:" + hash(ip), 12, 3600),
        "Too many rooms created. Try later.",
      );
      await store.clean();
      for (let i = 0; i < 5; i++) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
          code = Array.from(randomBytes(6), (b) => chars[b % 32]).join(""),
          id = randomUUID(),
          t = token(),
          data = {
            state: createState(code, id, Date.now()),
            members: { [hash(t)]: { id } },
            processed: {},
            invites: Array.from({ length: 3 }, () => ({
              key: token(),
              claimed: null,
            })),
          };
        if (await store.create(code, data))
          return send(res, 200, {
            token: t,
            id,
            snapshot: view(data.state, id),
            invites: data.invites.map((i) => i.key),
          });
      }
      throw Error("Unable to create a room. Please retry.");
    }
    assert(/^[A-HJ-NP-Z2-9]{6}$/.test(code || ""), "Enter a valid room code.");
    let data = await store.get(code);
    assert(
      data && data.state.expiresAt > Date.now(),
      "That room does not exist or has expired.",
    );
    if (tail === "join") {
      assert(req.method === "POST", "Method not allowed.");
      const b = await body(req);
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket?.remoteAddress ||
        "unknown";
      assert(
        await store.limit("join:" + hash(ip), 300),
        "Too many join attempts. Wait a moment.",
      );
      if (b.resumeToken)
        assert(
          typeof b.resumeToken === "string" &&
            /^[a-zA-Z0-9_-]{64,90}$/.test(b.resumeToken),
          "Invalid join credential.",
        );
      const t = b.resumeToken || token();
      for (let retry = 0; retry < 70; retry++) {
        const existing = data.members[hash(t)];
        if (existing)
          return send(res, 200, {
            token: t,
            id: existing.id,
            snapshot: view(data.state, existing.id),
          });
        const revision = data.state.revision,
          id = randomUUID(),
          role = b.invite ? "seller" : "customer";
        let inv;
        if (role === "seller") {
          assert(
            data.state.phase === "plan1",
            "Seller invitations open after the reaction round.",
          );
          inv = data.invites.find((i) => i.key === b.invite);
          assert(
            inv && !inv.claimed,
            "This seller invitation is invalid or already claimed.",
          );
        }
        addPlayer(data.state, { id, name: String(b.name || "").trim(), role });
        data.members[hash(t)] = { id };
        if (inv) inv.claimed = id;
        data.state.revision++;
        if (await store.cas(code, revision, data))
          return send(res, 200, {
            token: t,
            id,
            snapshot: view(data.state, id),
          });
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 150));
        data = await store.get(code);
      }
      throw Error("The room is busy. Please join again.");
    }
    const id = identity(req, data);
    if (tail === "snapshot" || tail === "resume")
      return send(res, 200, {
        snapshot: view(data.state, id),
        ...(data.state.players.find((p) => p.id === id)?.role === "host"
          ? { invites: data.invites.map((i) => i.key) }
          : {}),
      });
    if (tail === "events") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      let revision = -1,
        closed = false;
      const write = (d) => {
        if (!closed && d.state.revision > revision) {
          revision = d.state.revision;
          res.write(
            "data: " +
              JSON.stringify({
                snapshot: view(d.state, id),
                serverTime: Date.now(),
              }) +
              "\n\n",
          );
        }
      };
      let unsub;
      try {
        unsub = await store.subscribe(code, write);
        write(await store.get(code));
      } catch (e) {
        res.write(
          "event: error\ndata: " +
            JSON.stringify({
              error: "Live connection unavailable. Reconnecting.",
            }) +
            "\n\n",
        );
        res.end();
        return;
      }
      const heartbeat = setInterval(() => {
        if (!closed) res.write(": heartbeat\n\n");
      }, 15000);
      const catchup = setInterval(async () => {
        try {
          const d = await store.get(code);
          if (d) write(d);
          else cleanup();
        } catch {}
      }, 20000);
      const lifetime = setTimeout(cleanup, 240000);
      function cleanup() {
        if (closed) return;
        closed = true;
        unsub?.();
        clearInterval(heartbeat);
        clearInterval(catchup);
        clearTimeout(lifetime);
        res.end();
      }
      res.on("close", cleanup);
      return;
    }
    if (tail === "actions") {
      assert(req.method === "POST", "Method not allowed.");
      assert(
        await store.limit("actions:" + id, 180),
        "Too many actions. Wait a moment.",
      );
      const b = await body(req);
      assert(
        typeof b.clientActionId === "string" && b.clientActionId.length < 100,
        "Invalid action identifier.",
      );
      const key = id + ":" + b.clientActionId;
      if (data.processed[key])
        return send(res, 200, {
          snapshot: view(data.state, id),
          duplicate: true,
        });
      const revision = data.state.revision;
      if (b.expectedRevision !== revision)
        return send(res, 409, {
          snapshot: view(data.state, id),
          error: "The room changed. Updating your view.",
        });
      let payload = b.payload || {};
      if (b.type === "TRIAL_START")
        payload = {
          nonce: randomUUID(),
          delay: 1800 + (randomBytes(2).readUInt16BE() % 2800),
        };
      apply(data.state, id, b.type, payload, Date.now());
      data.state.revision++;
      data.processed[key] = data.state.revision;
      if (b.type === "PLAY_AGAIN")
        data.processed = { [key]: data.state.revision };
      if (!(await store.cas(code, revision, data))) {
        const newest = await store.get(code);
        if (newest.processed[key])
          return send(res, 200, {
            snapshot: view(newest.state, id),
            duplicate: true,
          });
        return send(res, 409, {
          snapshot: view(newest.state, id),
          error: "The room changed. Updating your view.",
        });
      }
      return send(res, 200, { snapshot: view(data.state, id) });
    }
    return send(res, 404, { error: "Route not found." });
  } catch (e) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const safe =
      e.message?.includes("postgres") || e.message?.includes("password")
        ? "The room service is unavailable. Please retry."
        : e.message;
    return send(res, 400, {
      error: safe || "The request could not be completed.",
    });
  }
}
