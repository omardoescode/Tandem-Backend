export default class PeerMatchingService {
  private static _instance: PeerMatchingService;
  private waitingClients: { id: string; res: ResponseStream }[] = [];
  public static instance() {
    if (!PeerMatchingService._instance) {
      PeerMatchingService._instance = new PeerMatchingService();
    }
    return PeerMatchingService._instance;
  }
  private constructor() {}
}
