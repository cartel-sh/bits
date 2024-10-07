// sakura
import { i } from "@instantdb/core";

const graph = i.graph(
	{
		$users: i.entity({
			email: i.any().unique(),
		}),
		sessions: i.entity({}),
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
