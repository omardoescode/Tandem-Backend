/* eslint-disable @typescript-eslint/no-explicit-any */
import auth from "@/auth/lib";
import type { SessionWsMessage, SessionWsResponse } from "@/session/validation";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function waitForOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", (err) => reject(err));
  });
}
function wait(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

function randomStr() {
  return Math.random().toString(36).slice(2, 10);
}

describe("Session Complete Test", () => {
  const PORT = 3000;
  const HOST = `localhost:${PORT}`;

  function generateRandomUser() {
    return {
      id: "",
      name: `Mock User`,
      email: `mock_${randomStr()}@example.com`,
      password: "Abc123456",
    };
  }

  const users = [generateRandomUser(), generateRandomUser()];
  let cookies: string[];

  beforeAll(async () => {
    cookies = await Promise.all(
      users.map(async (u, i) => {
        const res = await auth.api.signUpEmail({
          body: u,
          asResponse: true,
        });
        const id: string = await res.json().then((data) => data.user.id);
        users[i] = { ...users[i]!, id };

        const setCookieHeader = res.headers
          ?.getSetCookie()
          .find((c) => c.startsWith("better-auth.session_token"));

        if (!setCookieHeader) throw new Error("No session cookie returned");

        // Only keep the cookie name=value part
        const cookie = setCookieHeader.split(";")[0];
        return cookie as string;
      }),
    );
  });

  it("Session Main Test", async () => {
    const ws = await Promise.all(
      users.map(async (u, i) => {
        const res: any = await fetch(`${HOST}/api/session/get_ticket`, {
          headers: { cookie: cookies[i]! },
        }).then((x) => x.json());
        const ticket = res.data.ticket;

        const ws = new WebSocket(`ws:${HOST}/api/session/ws?ticket=${ticket}`);
        await waitForOpen(ws);
        const messages: SessionWsResponse[] = [];
        ws.addEventListener("message", (x) => {
          const msg = JSON.parse(x.data);
          messages.push(msg);
        });
        const tasks = [`task ${randomStr()}`, `task ${randomStr()}`];
        ws.send(
          JSON.stringify({
            type: "init_session",
            tasks,
            focus_duration: "00:00:05",
          } as SessionWsMessage),
        );

        await wait(1000);
        expect(messages[0]).toEqual({ type: "matching_pending" });
        messages.shift();

        await wait(1000);
        expect(messages[0]?.type).toEqual("start_session");
        const session_data = messages.shift();
        expect(session_data?.type).toEqual("start_session");
        expect(session_data?.tasks?.map((x) => x.title)).toEqual(tasks);

        await wait(5000); // now we have waited around 5 seconds for session to end
        expect(messages[0]?.type).toEqual("checkin_start");
        messages.shift();

        return ws;
      }),
    );

    const [user1_ws, user2_ws] = ws;

    const msg = randomStr();
    user1_ws?.send(
      JSON.stringify({
        type: "checkin_message",
        content: msg,
      } as SessionWsMessage),
    );

    const user2_messages: string[] = [];
    user2_ws?.addEventListener("message", (x) => {
      const msg = JSON.parse(x.data);
      user2_messages.push(msg);
    });

    await wait(100);
    expect(user2_messages[0]).toEqual({
      type: "checkin_partner_message",
      content: msg,
    } as SessionWsResponse);
    user2_messages.shift();

    user1_ws?.send(
      JSON.stringify({
        type: "checkin_report",
        reviewee_id: users[1]?.id,
        work_proved: true,
      } as SessionWsMessage),
    );

    user2_ws?.send(
      JSON.stringify({
        type: "checkin_report",
        reviewee_id: users[0]?.id,
        work_proved: true,
      } as SessionWsMessage),
    );

    await wait(100);
    expect(user2_messages[0]).toEqual({
      type: "checkin_report_sent",
      work_proved: true,
    } as SessionWsResponse);
    user2_messages.shift();

    expect(user2_messages[0]).toEqual({
      type: "session_done",
    } as SessionWsResponse);
    user2_messages.shift();
  }, 100000);

  afterAll(async () => {
    await Promise.all(
      users.map(async (u, i) => {
        const headers = {
          cookie: cookies[i]!,
        };
        await auth.api.deleteUser({
          body: {
            password: u.password,
          },
          headers,
        });
      }),
    );
  });
});
