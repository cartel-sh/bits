import { init } from "@instantdb/core";
import type { SakuraSchema } from "./schema";

const APP_ID = process.env.APP_ID;

if (!APP_ID) {
	throw new Error("APP_ID is not set, cannot initialize database");
}

export const db = init<SakuraSchema>({ appId: APP_ID });
