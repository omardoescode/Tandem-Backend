import moment from "moment";
import { Actor } from "@/framework/Actor";
import type { ActorRef } from "@/framework/ActorRef";
import type { ConnMessage } from "./ConnActor";
import ActorContext from "../framework/ActorContext";
import assert from "assert";
import type { TaskContext } from "./TaskActor";
import { v7 } from "uuid";
import { createCheckInReport, createSession } from "db/tandem_sessions_sql";
import interval from "postgres-interval";
import type { Client } from "@/types";

export type SessionMessage =
  | {
      type: "UserJoin";
      user_ref: ActorRef<ConnMessage>;
      duration: string;
      tasks: string[];
    }
  | { type: "StartSession"; client: Client }
  | { type: "CheckInStart" }
  | { type: "UserDisconnected"; user_id: string }
  | {
      type: "UserChatMessage";
      user_id: string;
      content: string;
      client: Client;
    }
  | {
      type: "SessionCheckInReport";
      from_id: string;
      to_id: string;
      work_proved: boolean;
      client: Client;
    };

type SessionState =
  | { type: "joining" }
  | { type: "running" }
  | { type: "checkin"; checkin_count: number }
  | { type: "finished" };

export class SessionActor extends Actor<SessionMessage> {
  private state: SessionState = { type: "joining" };
  private timeout: Timer | null = null;
  private users: { ref: ActorRef<ConnMessage>; tasks: string[] }[] = [];
  private duration: string | null = null;

  constructor(
    session_id: string,
    context: ActorContext<SessionMessage>,
    private task_ctx: TaskContext,
  ) {
    super(context, session_id);
  }

  protected override async handleMessage(
    message: SessionMessage,
  ): Promise<void> {
    switch (message.type) {
      case "UserJoin":
        if (this.duration === null) this.duration = message.duration;
        assert(this.duration === message.duration);

        if (!this.users.some((u) => u.ref.id === message.user_ref.id))
          this.users.push({ ref: message.user_ref, tasks: message.tasks });

        console.log(`Current user count: ${this.users.length}`);
        console.log(this.users);

        break;
      case "StartSession": {
        console.log("StartSession received");
        if (this.state.type !== "joining") return;
        assert(this.users.length !== 0 && this.duration !== null);

        const start_time = moment();
        const duration = moment.duration(this.duration, "seconds");

        this.timeout = setTimeout(() => {
          this.send({ type: "CheckInStart" });
        }, duration.asMilliseconds());

        this.state = { type: "running" };

        await createSession(message.client, {
          sessionId: this.id,
          scheduledDuration: interval(this.duration),
        });

        await Promise.all(
          this.users.map(async (u) => {
            // Create Tasks
            const tasks = await Promise.all(
              u.tasks.map(async (task) => {
                const task_ref = await this.task_ctx.spawn(v7());
                task_ref.send(
                  {
                    type: "toggle",
                    args: {
                      userId: u.ref.id,
                      sessionId: this.id,
                      title: task,
                      isComplete: false,
                    },
                  },
                  { type: "persist", client: message.client },
                );
                return { task_id: task_ref.id, title: task };
              }),
            );

            console.log(
              "about to send the users that their sessions are starting",
            );
            await u.ref.send({
              type: "SendUserMessage",
              content: {
                type: "start_session",
                partners: this.users
                  .filter((p) => p.ref.id != u.ref.id)
                  .map((p) => ({
                    id: p.ref.id,
                    tasks: p.tasks,
                  })),

                tasks,
                start_time: start_time.toISOString(),
                scheduled_end_time: start_time
                  .clone()
                  .add(duration)
                  .toISOString(),
              },
            });
          }),
        );

        break;
      }

      case "CheckInStart": {
        const now = moment();
        const end = now.clone().add(2, "minute");
        this.users.forEach((u) =>
          u.ref.send({
            type: "SendUserMessage",
            content: {
              type: "checkin_start",
              start_time: now.toISOString(),
              scheduled_end_time: end.toISOString(),
            },
          }),
        );
        this.timeout = null;
        this.state = { type: "checkin", checkin_count: 0 };
        break;
      }

      case "UserDisconnected": {
        const ref = this.users.findIndex((r) => r.ref.id === message.user_id);
        if (!ref) {
          console.warn(`User ${message.user_id} doesn't belong to session`);
          return;
        }

        this.users.splice(ref, 1);

        this.users.forEach((u) =>
          u.ref.send({
            type: "SendUserMessage",
            content: {
              type: "other_used_disconnected",
            },
          }),
        );

        break;
      }
      case "UserChatMessage":
        if (this.state.type !== "checkin") {
          console.warn(
            `Session not in CHECKIN state; ignoring message from user ${message.user_id}`,
          );
          return;
        }

        await Promise.all(
          this.users.map(async (u) => {
            console.log(u.ref.id, u.ref.id !== message.user_id);
            if (u.ref.id !== message.user_id)
              await u.ref.send({
                type: "SendUserMessage",
                content: {
                  type: "checkin_partner_message",
                  content: message.content,
                },
              });
          }),
        );
        break;

      case "SessionCheckInReport": {
        if (this.state.type !== "checkin") {
          console.warn(
            `Session not in CHECKIN state; ignoring checkin report from ${message.from_id}`,
          );
          return;
        }

        await createCheckInReport(message.client, {
          sessionId: this.id,
          revieweeId: message.from_id,
          reviewerId: message.to_id,
          workProved: message.work_proved,
        });

        await Promise.all(
          this.users.map(async (u) => {
            if (u.ref.id !== message.from_id)
              await u.ref.send({
                type: "SendUserMessage",
                content: {
                  type: "checkin_report_sent",
                  work_proved: message.work_proved,
                },
              });
          }),
        );

        this.state.checkin_count++;

        if (this.state.checkin_count === this.users.length) {
          this.state = { type: "finished" };

          await Promise.all(
            this.users.map(async (u) => {
              u.ref.send({
                type: "SessionOver",
              });
            }),
          );

          await this.context.delete(this.id);
        }
      }
    }
  }
}

export class SessionContext extends ActorContext<SessionMessage> {
  public override actor_category: string = "session";

  constructor(private task_context: TaskContext) {
    super();
  }

  protected override create_actor(id: string): Actor<SessionMessage> {
    return new SessionActor(id, this, this.task_context);
  }
}
