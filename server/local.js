import http from "node:http";
if (!process.env.DATABASE_URL) process.env.LOCAL_STORE_DIR ||= "./.local-rooms";
const { handler } = await import("./service.js");
http
  .createServer(handler)
  .listen(8788, "127.0.0.1", () =>
    console.log("Local durable room server on http://127.0.0.1:8788"),
  );
