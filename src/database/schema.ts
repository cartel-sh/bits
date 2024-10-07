export interface StudySession {
	id: string;
	startTime: Date;
	endTime: Date;
	duration: number;
	createdAt: Date;
}

export type StudyTracker = {
	version: 1;
	handle: string;
	sessions: StudySession[];
};
