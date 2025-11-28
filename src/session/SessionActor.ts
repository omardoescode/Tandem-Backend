import moment from "moment";
import { Actor } from "@/framework/Actor";
import type { ActorRef } from "@/framework/ActorRef";
import type { UserMessage } from "./UserActor";
import ActorContext from "../framework/ActorContext";
import assert from "assert";
import type { TaskContext } from "./TaskActor";
import { v7 } from "uuid";
import type { DBClientMessage } from "./DBClientActor";

export type SessionMessage =
  | {
      type: "UserJoin";
      user_ref: ActorRef<UserMessage>;
      duration_seconds: number;
      tasks: string[];
    }
  | { type: "StartSession"; client: ActorRef<DBClientMessage> }
  | { type: "TimerExpired" }
  | { type: "UserDisconnected"; user_id: string }
  | { type: "UserChatMessage"; user_id: string; content: string }
  | { type: "SessionCheckInReport"; from_id: string; work_proved: boolean };

enum SessionState {
  JOINING,
  RUNNING,
  CHECKIN,
}

export class SessionActor extends Actor<SessionMessage> {
  private state: SessionState = SessionState.JOINING;
  private timeout: Timer | null = null;
  private users: { ref: ActorRef<UserMessage>; tasks: string[] }[] = [];
  private duration_seconds: number | null = null;

  constructor(
    session_id: string,
    private task_ctx: TaskContext,
  ) {
    super(session_id);
  }

  protected override async handleMessage(
    message: SessionMessage,
  ): Promise<void> {
    switch (message.type) {
      case "UserJoin":
        if (this.duration_seconds === null)
          this.duration_seconds = message.duration_seconds;
        assert(this.duration_seconds === message.duration_seconds);

        if (!this.users.some((u) => u.ref.id === message.user_ref.id))
          this.users.push({ ref: message.user_ref, tasks: message.tasks });

        break;
      case "StartSession": {
        console.log("StartSession received");
        if (this.state !== SessionState.JOINING) return;
        assert(this.users.length !== 0 && this.duration_seconds !== null);

        const start_time = moment();
        const duration = moment.duration(this.duration_seconds, "seconds");

        this.timeout = setTimeout(() => {
          this.send({ type: "TimerExpired" });
        }, duration.asMilliseconds());

        this.state = SessionState.RUNNING;

        await Promise.all(
          this.users.map(async (u) => {
            // Create Tasks
            const tasks = await Promise.all(
              u.tasks.map(async (task) => {
                const task_ref = await this.task_ctx.spawn(v7());
                task_ref.send({
                  type: "Create",
                  user_id: u.ref.id,
                  db_client: message.client,
                  session_id: this.id,
                  task,
                });
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

      case "TimerExpired": {
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
        this.state = SessionState.CHECKIN;
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
        if (this.state !== SessionState.CHECKIN) {
          console.warn(`User ${message.user_id} doesn't belong to session`);
          return;
        }

        this.users.forEach((u) => {
          if (u.ref.id != message.user_id)
            u.ref.send({
              type: "SendUserMessage",
              content: {
                type: "checkin_partner_message",
                content: message.content,
              },
            });
        });
        break;

      case "SessionCheckInReport": {
        this.users.forEach((u) => {
          if (u.ref.id !== message.from_id)
            u.ref.send({
              type: "SendUserMessage",
              content: {
                type: "checkin_report_sent",
                work_proved: message.work_proved,
              },
            });
        });
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
    return new SessionActor(id, this.task_context);
  }
}
