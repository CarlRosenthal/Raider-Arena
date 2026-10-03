// Shared reconnecting transport. Commands are never queued or replayed.
(() => {
  async function api(path, body) {
    const response = await fetch(
      path,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = await response
      .json()
      .catch(() => ({ error: "Remote control requires Cloudflare hosting." }));
    if (!response.ok)
      throw new Error(data.error || "Connection failed. Sign in again.");
    return data;
  }
  class Link {
    constructor(credentials, onMessage, onStatus) {
      this.credentials = credentials;
      this.onMessage = onMessage;
      this.onStatus = onStatus;
      this.stopped = false;
      this.attempt = 0;
      this.lastMessage = Date.now();
      this.connect();
      this.heartbeat = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          if (Date.now() - this.lastMessage > 15000) this.socket.close();
          else this.send({ type: "ping" });
        }
      }, 5000);
    }
    connect() {
      if (this.stopped) return;
      this.onStatus("connecting");
      const url = new URL(
        `/api/rooms/${this.credentials.code}/socket`,
        location.href,
      );
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = (this.socket = new WebSocket(url, [
        "raider-v1",
        this.credentials.token,
      ]));
      ws.onopen = () => {
        if (this.stopped || this.socket !== ws) return;
        this.attempt = 0;
        this.lastMessage = Date.now();
      };
      ws.onmessage = (event) => {
        if (this.stopped || this.socket !== ws) return;
        this.lastMessage = Date.now();
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === "ready") this.onStatus("connected");
        if (data.type === "ended") {
          this.stop();
          this.onStatus("ended");
        }
        this.onMessage(data);
      };
      ws.onclose = (event) => {
        if (this.stopped || this.socket !== ws) return;
        if (
          [4000, 4001, 4003].includes(event.code) ||
          Date.now() >= this.credentials.expiresAt ||
          this.attempt >= 8
        ) {
          this.stop();
          this.onStatus("ended");
          return;
        }
        this.onStatus("disconnected");
        this.timer = setTimeout(
          () => this.connect(),
          Math.min(1000 * 2 ** this.attempt++, 10000),
        );
      };
      ws.onerror = () => {};
    }
    send(data) {
      if (this.socket?.readyState !== WebSocket.OPEN) return false;
      this.socket.send(JSON.stringify(data));
      return true;
    }
    stop() {
      this.stopped = true;
      clearTimeout(this.timer);
      clearInterval(this.heartbeat);
      this.socket?.close();
    }
  }
  window.ArenaRemote = { api, Link };
})();
