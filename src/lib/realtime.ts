// Realtime WebSocket Manager replacing Supabase Realtime

type EventCallback = (payload: any) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnecting: boolean = false;
  private reconnectTimer: any = null;

  constructor() {
    this.listeners.set("ORDER_CREATED", new Set());
    this.listeners.set("ORDER_UPDATED", new Set());
    this.listeners.set("DATA_CHANGED", new Set());
  }

  public connect() {
    if (typeof window === "undefined" || this.ws || this.isConnecting) return;

    this.isConnecting = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type;
          const payload = data.payload;

          const callbackSet = this.listeners.get(type);
          if (callbackSet) {
            callbackSet.forEach((cb) => cb(payload));
          }
        } catch (e) {
          console.warn("Error parsing WebSocket message:", e);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        // Reconnect after 3 seconds
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
    }
  }

  public subscribe(event: "ORDER_CREATED" | "ORDER_UPDATED" | "DATA_CHANGED", callback: EventCallback) {
    this.connect();
    const set = this.listeners.get(event);
    if (set) {
      set.add(callback);
    }
    return () => {
      set?.delete(callback);
    };
  }
}

export const realtime = new RealtimeClient();
