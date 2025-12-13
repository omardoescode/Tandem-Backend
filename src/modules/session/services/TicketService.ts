class TicketManager {
  private tickets: Map<string, [string, NodeJS.Timeout | null]> = new Map();

  constructor() {
    this.tickets.set("0", ["lJxDlQBeezRZsGPvSPvzafBC07PuLzvt", null]);
    this.tickets.set("1", ["VZYFafEecXby01sFuXBhnJGbKZ8qU76T", null]);
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
    if (timer) clearTimeout(timer);
    this.tickets.delete(ticketId);
    return userId;
  }
}

export const TicketService = new TicketManager();
