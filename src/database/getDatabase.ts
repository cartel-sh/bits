import { init_experimental } from "@instantdb/core";

// @ts-ignore
import schema from '../../instant.schema.ts';

const APP_ID = process.env.INSTANT_APP_ID;

if (!APP_ID) {
	throw new Error("APP_ID is not set, cannot initialize database");
}

export const db = init_experimental({ appId: APP_ID, schema });
