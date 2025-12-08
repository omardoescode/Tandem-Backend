class TicketManager {
  private tickets: Map<string, [string, NodeJS.Timeout]> = new Map();

  constructor() {
    // this.tickets.set("0", "8gapCqLe4Ll1FlW6fSq1YSVT4FoAGrZW");
    // this.tickets.set("1", "XczPuGGIiXElMDZKgrrtc4D5j2lzwTCL");
  }

  public addTicket(userId: string): string {
    const ticketId = crypto.randomUUID();
    const timer = setTimeout(
      () => {
        this.tickets.delete(ticketId);
      },
      5 * 60 * 1000,
    );
    this.tickets.set(ticketId, [userId, timer]);
    return ticketId;
  }

  public useTicket(ticketId: string): false | string {
    const res = this.tickets.get(ticketId);
    if (!res) return false;
    const [userId, timer] = res;
    clearTimeout(timer);
    this.tickets.delete(ticketId);
    return userId;
  }
}

export const TicketService = new TicketManager();
