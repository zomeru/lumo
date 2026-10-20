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
        if (message.channel === "lumo_wiki") void wiki.refresh(message.payload).catch(failed);
        if (message.channel === "lumo_wiki_awareness") wiki.awareness(message.payload);
      });
      await connection.query("LISTEN lumo_wiki");
      await connection.query("LISTEN lumo_wiki_awareness");
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
