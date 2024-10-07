import { init } from "@instantdb/core";
import type { StudyTracker } from "./schema";

const APP_ID = process.env.INSTANT_APP_ID;

if (!APP_ID) {
	throw new Error("APP_ID is not set, cannot initialize database");
}

export const db = init<StudyTracker>({ appId: APP_ID });
