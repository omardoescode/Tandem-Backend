import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { serve } from "bun";
import app from "@/index";

let server: ReturnType<typeof serve>;
let port: number;

describe("WebSocket Matching route", () => {
  beforeAll(async () => {
    server = serve({
      port: 0, // pick random available port
      fetch: app.fetch,
      websocket: app.websocket,
    });
    if (server.port) port = server.port;
    console.log(`Test server running on port ${port}`);
  });

  afterAll(() => {
    if (server) server.stop();
  });

  it("should connect and receive a response", async () => {
    const url = `ws://localhost:${port}/api/match/`;
    const ws = new WebSocket(url);

    const messagePromise = new Promise<string>((resolve, reject) => {
      ws.on("open", () => {
        ws.send("test message");
      });

      ws.on("message", (data) => {
        resolve(data.toString());
        ws.close();
      });

      ws.on("error", reject);
    });

    const response = await messagePromise;
    expect(response).toBe("Hello from server!");
  });
});
