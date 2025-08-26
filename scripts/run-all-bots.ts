#!/usr/bin/env bun

import { spawn } from "bun";

const bots = ["kudasai", "sakura", "onjo"]; // Removed kumiko as it doesn't exist

console.log("🚀 Starting all bots...\n");

const processes = bots.map((bot) => {
	console.log(`Starting ${bot}...`);
	return spawn(["bun", "run", `./bits/${bot}/index.ts`], {
		stdout: "inherit",
		stderr: "inherit",
		stdin: "inherit",
	});
});

process.on("SIGINT", () => {
	console.log("\n\n⛔ Shutting down all bots...");
	for (const proc of processes) {
		proc.kill();
	}
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n\n⛔ Shutting down all bots...");
	for (const proc of processes) {
		proc.kill();
	}
	process.exit(0);
});

await Promise.all(processes.map((proc) => proc.exited));