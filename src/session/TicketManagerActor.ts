import { Actor } from "@/framework/Actor";
import ActorContext from "@/framework/ActorContext";

export type TicketMessage =
  | {
      type: "AddTicket";
      user_id: string;
      expiration_seconds: number;
      _reply?: (ticket_id: string) => Promise<void> | void;
    }
  | {
      type: "UseTicket";
      ticket_id: string;
      _reply?: (user_id: string | null) => Promise<void> | void;
    };

export class TicketManagerActor extends Actor<TicketMessage> {
  private tickets: Map<string, [string, NodeJS.Timeout | null]> = new Map();
  private ticket_id: number = 0;

  constructor(id: string, context: ActorContext<TicketMessage>) {
    super(context, id);
  }

  protected override async handleMessage(
    message: TicketMessage,
  ): Promise<void> {
    switch (message.type) {
      case "AddTicket": {
        const id = (this.ticket_id++).toString();

        const timeout =
          message.expiration_seconds === -1
            ? null
            : setTimeout(() => {
                // this.tickets.delete(id);
              }, message.expiration_seconds * 1000);

        this.tickets.set(id, [message.user_id, timeout]);

        message._reply?.(id);
        break;
      }

      case "UseTicket": {
        const tickets = this.tickets.get(message.ticket_id);
        if (tickets) {
          const [user_id, timeout] = tickets;
          // if (timeout) clearTimeout(timeout);
          // this.tickets.delete(message.ticket_id);
          message._reply?.(user_id);
        } else {
          message._reply?.(null);
        }
        break;
      }
    }
  }
}

export class TicketManagerContext extends ActorContext<TicketMessage> {
  public override actor_category: string = "ticket_manager";
  protected override create_actor(id: string): Actor<TicketMessage> {
    const res = new TicketManagerActor(id, this);
    return res;
  }
}
