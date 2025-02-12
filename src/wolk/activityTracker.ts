import { RedisClientType } from "redis";
import { Client, VoiceState } from "discord.js";
import { DateTime } from "luxon";
export class ActivityTracker {
    private activityTracker: Map<string, {warningTimer: NodeJS.Timeout, endTimer: NodeJS.Timeout}>;
    constructor(private readonly client: Client, private readonly redis: RedisClientType) {
        this.activityTracker = new Map();
    }

    async trackActivity(oldState: VoiceState, newState: VoiceState) {
        if (oldState.channelId !== newState.channelId) {
            if (newState.channelId) {
                await this._storeActivityStart(newState.member?.user.id);
            } else {
                await this._storeActivityEnd(oldState.member?.user.id);
            }
        }
    }

    async updateStatistics() {
        // get the current day
        const currentDay = DateTime.now().toFormat("yyyy-MM-dd");
        // get the tracking set
        const trackingSet = await this.redis.sMembers(`activity:tracking:${currentDay}`);
        // get the durations for each user
        for (const userId of trackingSet) {
            let duration = await this.redis.get(`activity:${userId}:duration:${currentDay}`);
            // if there is no duration, check if there is an activity start stored
            if (!duration) {
                const activityStart = await this.redis.get(`activity:${userId}`);
                if (activityStart) {
                    // calculate the duration
                    duration = ((new Date().getTime() - new Date(activityStart).getTime()) / 1000).toString();
                }
            }
        }
    }

    async _storeActivityStart(userId: string) {
        // check if there is already an activity start stored
        const activityStart = await this.redis.get(`activity:${userId}`);
        if (activityStart) {
            return;
        }
        await this.redis.set(`activity:${userId}`, new Date().toISOString());
        // add the user to the tracking set
        await this._addUserToTrackingSet(userId);

    }

    async _storeActivityEnd(userId: string) {
        // check if there is an activity start stored
        const activityStart = await this.redis.get(`activity:${userId}`);
        if (!activityStart) {
            return;
        }
        // if yes calculate the duration
        const duration = (new Date().getTime() - new Date(activityStart).getTime()) / 1000;
        // store the duration
        // get the existing duration if any 
        const existingDuration = await this.redis.get(`activity:${userId}:duration:${DateTime.now().toFormat("yyyy-MM-dd")}`);
        if (existingDuration) {
            let parsedDuration = parseInt(existingDuration);
            if (isNaN(parsedDuration)) {
                parsedDuration = 0;
            }
            parsedDuration += duration;
            await this.redis.set(`activity:${userId}:duration:${DateTime.now().toFormat("yyyy-MM-dd")}`, parsedDuration.toString());
        } else {
            await this.redis.set(`activity:${userId}:duration:${DateTime.now().toFormat("yyyy-MM-dd")}`, duration.toString());
        }
        // delete the activity start
        await this.redis.del(`activity:${userId}`);
    }

    _startTimer(userId: string) {
        // set a time for 1 hours and remind user
        const warningTimer = setTimeout(async () => {
            // warn the user
        }, 2 * 60 * 60 * 1000);
        // set a time for 2 hours and kick user
        const endTimer = setTimeout(async () => {

        }, 4 * 60 * 60 * 1000);
        this.activityTracker.set(userId, {warningTimer, endTimer});
    }

    _resetTimers(userId: string) {
        clearTimeout(this.activityTracker.get(userId).warningTimer);
        clearTimeout(this.activityTracker.get(userId).endTimer);
    }

    async _addUserToTrackingSet(userId: string) {
        await this.redis.sAdd(`activity:tracking:${DateTime.now().toFormat("yyyy-MM-dd")}`, userId);
    }

    async _cleanTrackingSet(timestamp: string) {
        // use del to delete the set
        await this.redis.del(`activity:tracking:${timestamp}`);
    }
}