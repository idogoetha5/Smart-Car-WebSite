export interface ThreadMessage {
  id: number;
  source: 'customer_inbound' | 'bot_outbound' | 'human_reply';
  body: string;
  created_at: string;
  escalated_at: string | null;
}
export type ThreadPage = { data: ThreadMessage[]; pagination: { hasMore: boolean; before: number | null; after: number | null } };
export type ThreadSnapshot = { messages: ThreadMessage[]; hasOlder: boolean };

/** One feed per mounted phone, owned by SWR's fetcher, never global storage.
 * Retains loaded history while polling only forward from the last observed ID.
 * Failure leaves cursors and messages intact; no customer data in localStorage.
 */
export class WhatsAppThreadFeed {
  private messages = new Map<number, ThreadMessage>();
  private first: number | null = null;
  private last: number | null = null;
  private hasOlder = false;
  private initialized = false;
  private polling: Promise<ThreadSnapshot> | null = null;
  private older: Promise<ThreadSnapshot> | null = null;
  constructor(private readonly url: string, private readonly read: (url: string) => Promise<ThreadPage>) {}
  snapshot(): ThreadSnapshot {
    return { messages: [...this.messages.values()].sort((a, b) => a.id - b.id), hasOlder: this.hasOlder };
  }
  private merge(page: ThreadPage) {
    for (const message of page.data) {
      this.messages.set(message.id, message);
      this.first = this.first === null ? message.id : Math.min(this.first, message.id);
      this.last = this.last === null ? message.id : Math.max(this.last, message.id);
    }
  }
  refresh(): Promise<ThreadSnapshot> {
    if (this.polling) return this.polling;
    this.polling = this.forward().finally(() => { this.polling = null; });
    return this.polling;
  }
  private async forward(): Promise<ThreadSnapshot> {
    if (!this.initialized) {
      const page = await this.read(this.url);
      this.merge(page); this.hasOlder = page.pagination.hasMore; this.initialized = true;
    } else {
      // Bounded per refresh, but the cursor advances page by page. A large burst
      // continues at the next refresh rather than skipping to the newest 100.
      for (let count = 0; count < 5; count++) {
        const prior = this.last;
        const page = await this.read(prior === null ? this.url : `${this.url}?after=${prior}`);
        this.merge(page);
        if (prior === null) this.hasOlder = page.pagination.hasMore;
        if (!page.pagination.hasMore || this.last === prior) break;
      }
    }
    return this.snapshot();
  }
  loadOlder(): Promise<ThreadSnapshot> {
    if (this.older) return this.older;
    this.older = this.backward().finally(() => { this.older = null; });
    return this.older;
  }
  private async backward(): Promise<ThreadSnapshot> {
    if (!this.initialized) await this.refresh();
    if (this.hasOlder && this.first !== null) {
      const page = await this.read(`${this.url}?before=${this.first}`);
      this.merge(page); this.hasOlder = page.pagination.hasMore;
    }
    return this.snapshot();
  }
}
