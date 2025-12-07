// TODO: Add timers to remove the old tickets
class TicketManager {
  private tickets: Map<string, string> = new Map();

  constructor() {
    this.tickets.set("0", "8gapCqLe4Ll1FlW6fSq1YSVT4FoAGrZW");
    this.tickets.set("1", "XczPuGGIiXElMDZKgrrtc4D5j2lzwTCL");
  }

  public addTicket(userId: string): string {
    const ticketId = crypto.randomUUID();
    this.tickets.set(ticketId, userId);
    return ticketId;
  }

  public useTicket(ticket_id: string): false | string {
    const res = this.tickets.get(ticket_id);
    return res ? res : false;
  }
}

export const TicketService = new TicketManager();
