type Notification = { channel: string; payload?: string };
type Connection = {
  query(statement: string): Promise<unknown>;
  on(event: "error" | "end" | "notification", listener: (value: Notification) => void): unknown;
  release(destroy?: boolean): void;
};

// LISTEN belongs to a connection, so a replacement must subscribe again after a disconnect.
export async function listenForWiki(
  pool: { connect(): Promise<Connection> },
  wiki: { refresh(id: string): Promise<void>; awareness(payload: string): void },
  failed: () => void,
  messenger?: {
    refresh(workspaceId: string): Promise<void>;
    typing(payload: string): void;
    presence?(workspaceId: string): Promise<void>;
  },
) {
  let stopped = false,
    current: Connection | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    pending: Promise<void>;
  function schedule() {
    if (stopped || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      pending = connect();
    }, 5000);
    retry.unref();
  }
  async function connect() {
    let connection: Connection | undefined;
    try {
      connection = await pool.connect();
      if (stopped) {
        connection.release();
        return;
      }
      current = connection;
      const acquired = connection;
      const lost = () => {
        if (current !== acquired) return;
        current = undefined;
        acquired.release(true);
        failed();
        schedule();
      };
      connection.on("error", lost);
      connection.on("end", lost);
      connection.on("notification", (message) => {
        if (stopped || current !== acquired || !message.payload) return;
        if (message.channel === "lumolynk_wiki") void wiki.refresh(message.payload).catch(failed);
        if (message.channel === "lumolynk_wiki_awareness") wiki.awareness(message.payload);
        if (message.channel === "lumolynk_messenger")
          void messenger?.refresh(message.payload).catch(failed);
        if (message.channel === "lumolynk_messenger_presence")
          void messenger?.presence?.(message.payload).catch(failed);
        if (message.channel === "lumolynk_messenger_typing") messenger?.typing(message.payload);
      });
      await connection.query("LISTEN lumolynk_wiki");
      await connection.query("LISTEN lumolynk_wiki_awareness");
      if (messenger) {
        await connection.query("LISTEN lumolynk_messenger");
        await connection.query("LISTEN lumolynk_messenger_typing");
        await connection.query("LISTEN lumolynk_messenger_presence");
      }
    } catch {
      if (current === connection && connection) {
        current = undefined;
        connection.release(true);
      }
      if (!stopped) {
        failed();
        schedule();
      }
    }
  }
  pending = connect();
  await pending;
  return {
    async close() {
      stopped = true;
      if (retry) clearTimeout(retry);
      await pending;
      current?.release();
      current = undefined;
    },
  };
}
