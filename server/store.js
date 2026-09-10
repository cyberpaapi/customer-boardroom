import { neon, Client, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
neonConfig.webSocketConstructor = WebSocket;
export class Store extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
    this.local = process.env.LOCAL_STORE_DIR;
    this.sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
    this.ready = null;
    this.listener = null;
    this.connecting = null;
    this.retryTimer = null;
    this.connections = 0;
  }
  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (this.local) {
        await fs.mkdir(this.local, { recursive: true });
        return;
      }
      if (!this.sql) throw Error("Online rooms are not configured yet.");
      await this
        .sql`CREATE TABLE IF NOT EXISTS boardroom_rooms (code text PRIMARY KEY, revision integer NOT NULL, data jsonb NOT NULL, expires_at timestamptz NOT NULL)`;
      await this
        .sql`CREATE TABLE IF NOT EXISTS boardroom_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`;
    })();
    try {
      await this.ready;
    } catch (e) {
      this.ready = null;
      throw e;
    }
  }
  async get(code) {
    await this.init();
    if (this.local) {
      try {
        return JSON.parse(
          await fs.readFile(path.join(this.local, code + ".json"), "utf8"),
        );
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    }
    const r = await this
      .sql`SELECT data FROM boardroom_rooms WHERE code=${code} AND expires_at>now()`;
    return r[0]?.data || null;
  }
  async create(code, data) {
    await this.init();
    if (this.local) {
      try {
        await fs.writeFile(
          path.join(this.local, code + ".json"),
          JSON.stringify(data),
          { flag: "wx" },
        );
        return true;
      } catch (e) {
        if (e.code === "EEXIST") return false;
        throw e;
      }
    }
    const r = await this
      .sql`INSERT INTO boardroom_rooms(code,revision,data,expires_at) VALUES(${code},${data.state.revision},${JSON.stringify(data)}::jsonb,to_timestamp(${data.state.expiresAt}/1000.0)) ON CONFLICT DO NOTHING RETURNING code`;
    return !!r.length;
  }
  async cas(code, revision, data) {
    await this.init();
    if (this.local) {
      this.queue = this.queue || Promise.resolve();
      const job = this.queue.then(async () => {
        const old = await this.get(code);
        if (!old || old.state.revision !== revision) return false;
        await fs.writeFile(
          path.join(this.local, code + ".tmp"),
          JSON.stringify(data),
        );
        await fs.rename(
          path.join(this.local, code + ".tmp"),
          path.join(this.local, code + ".json"),
        );
        this.emit(code, data);
        return true;
      });
      this.queue = job.catch(() => {});
      return job;
    }
    const r = await this
      .sql`WITH changed AS (UPDATE boardroom_rooms SET revision=${data.state.revision},data=${JSON.stringify(data)}::jsonb WHERE code=${code} AND revision=${revision} RETURNING code) SELECT code,pg_notify('boardroom_events',code) FROM changed`;
    if (r.length) this.emit(code, data);
    return !!r.length;
  }
  async limit(key, max, windowSeconds = 60) {
    await this.init();
    if (this.local) return true;
    const rows = await this
      .sql`INSERT INTO boardroom_rate_limits(key,count,expires_at) VALUES(${key},1,now()+${windowSeconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN boardroom_rate_limits.expires_at<now() THEN 1 ELSE boardroom_rate_limits.count+1 END,expires_at=CASE WHEN boardroom_rate_limits.expires_at<now() THEN now()+${windowSeconds}*interval '1 second' ELSE boardroom_rate_limits.expires_at END RETURNING count`;
    return rows[0].count <= max;
  }
  async clean() {
    if (!this.sql) return;
    await this.sql`DELETE FROM boardroom_rooms WHERE expires_at<now()`;
    await this.sql`DELETE FROM boardroom_rate_limits WHERE expires_at<now()`;
  }
  async listen() {
    if (this.local) return;
    if (this.listener) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const c = new Client(
        process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
      );
      c.on("notification", async (msg) => {
        if (msg.channel === "boardroom_events") {
          try {
            const data = await this.get(msg.payload);
            if (data) this.emit(msg.payload, data);
          } catch {}
        }
      });
      const reconnect = () => {
        if (this.listener === c) {
          this.listener = null;
          if (this.connections)
            this.retryTimer = setTimeout(
              () => this.listen().catch(() => {}),
              1000,
            );
        }
      };
      c.on("error", reconnect);
      c.on("end", reconnect);
      await c.connect();
      await c.query("LISTEN boardroom_events");
      this.listener = c;
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }
  async subscribe(code, fn) {
    this.connections++;
    this.on(code, fn);
    try {
      await this.listen();
    } catch (e) {
      this.connections--;
      this.off(code, fn);
      throw e;
    }
    return () => {
      this.off(code, fn);
      this.connections--;
      if (!this.connections) {
        clearTimeout(this.retryTimer);
        const c = this.listener;
        this.listener = null;
        c?.end().catch(() => {});
      }
    };
  }
}
export const store = new Store();
