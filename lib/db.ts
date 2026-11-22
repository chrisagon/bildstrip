import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import "../envConfig.ts";
import { requireDatabaseUrl } from "./db-config";

export { requireDatabaseUrl };

let instance: NeonHttpDatabase | null = null;

function connect(): NeonHttpDatabase {
  instance ??= drizzle(neon(requireDatabaseUrl()));
  return instance;
}

/**
 * Lazily connected handle. Importing this module never touches the database or
 * requires its configuration; the first query does. Next evaluates route
 * modules while collecting build configuration, so an import-time throw here
 * breaks `next build` on any deployment without DATABASE_URL.
 */
export const db: NeonHttpDatabase = new Proxy({} as NeonHttpDatabase, {
  get(_target, property) {
    const client = connect();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
