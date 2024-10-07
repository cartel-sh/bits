import { exec } from "node:child_process";
import type { Request, Response } from "express";
import express from "express";

const app = express();

const config = {
	port: process.argv[2],
	githubWebhookSecret: process.argv[3],
};

if (!config.port || !config.githubWebhookSecret) {
	console.error("Missing watchtower config arguments");
	process.exit(1);
}

app.use(express.json());
app.post("/hook", (req: Request, res: Response) => {
	// Only listen to push events
	checkEventType(req, res);

	// Make sure we're communicating with github
	verifySignature(req, res, config.githubWebhookSecret);

	// Pull new code and run the watchtower script
	runWatchtowerActions(req);
});

app.listen(config.port, () => {
	console.log(`Server is running on port ${config.port}`);
});

export function checkEventType(req: Request, res: Response): void {
	const githubEvent: string = req.headers["x-github-event"] as string;
	const isGithubPushEvent: boolean = githubEvent === "push";

	if (!isGithubPushEvent) {
		console.log("Dismissing event", githubEvent, "Reason: not a push event");
		res.status(204).send("Dismissed event");
	}
}

export function verifySignature(
	req: Request,
	res: Response,
	secret: string,
): void {
	const githubSignature: string | undefined = req.headers["x-hub-signature"] as
		| string
		| undefined;
	if (!githubSignature) {
		console.error("GitHub signature is not defined", req.headers);
		res.status(400).send("Invalid request: GitHub signature is not defined");
		return;
	}

	const crypto = require("node:crypto");
	const hmac = crypto.createHmac("sha1", secret);
	const payload: string = JSON.stringify(req.body);
	const expectedSignature: string = `sha1=${hmac
		.update(payload)
		.digest("hex")}`;
	if (
		!crypto.timingSafeEqual(
			Buffer.from(githubSignature),
			Buffer.from(expectedSignature),
		)
	) {
		console.error("GitHub signature verification failed");
		res.status(400).send("GitHub signature verification failed");
	} else {
		console.log("GitHub signature verified");
		res.status(200).send("Received successfully");
	}
}

export async function runWatchtowerActions(req: Request): Promise<void> {
	console.log("Watchtower: New commit pushed: ", req.body.head_commit?.id);

	try {
		exec("./services/pull.sh", (error, stdout, stderr) => {
			if (error) console.error(stderr);
			if (stdout) console.log(stdout);
		});
	} catch (execError) {
		console.error(execError);
	}
}
