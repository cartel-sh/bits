// sakura
// https://instantdb.com/dash?s=main&t=home&app=b01be168-13d9-467f-bcdb-bb213323088c

import { i } from "@instantdb/core";

const graph = i.graph(
	{
		sessions: i.entity({
			duration: i.any(),
			startTime: i.any(),
			endTime: i.any(),
		}),
		users: i.entity({
			createdAt: i.any(),
			handle: i.any().unique(),
			role: i.any(),
		}),
	},

	{
		sessionsUser: {
			forward: {
				on: "sessions",
				has: "one",
				label: "user",
			},
			reverse: {
				on: "users",
				has: "many",
				label: "sessions",
			},
		},
	},
);

export default graph;
