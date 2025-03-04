import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const connectionOptions = {
  prepare: true,
  max: 10,
  idle_timeout: 20,
};

export const queryClient = postgres(
  process.env.DATABASE_URL,
  connectionOptions,
);

export const db = drizzle(queryClient, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export * from "./schema";
