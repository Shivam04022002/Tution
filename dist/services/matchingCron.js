"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMatchingCron = startMatchingCron;
exports.stopMatchingCron = stopMatchingCron;
const MatchingService_1 = require("./MatchingService");
const BATCH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let batchTimer = null;
let cleanupTimer = null;
function startMatchingCron() {
    if (batchTimer || cleanupTimer) {
        console.log('[MatchingCron] Already running, skipping start.');
        return;
    }
    console.log('[MatchingCron] Starting cron jobs...');
    runBatchMatch();
    runCleanup();
    batchTimer = setInterval(runBatchMatch, BATCH_INTERVAL_MS);
    cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
    console.log(`[MatchingCron] Batch match every ${BATCH_INTERVAL_MS / 3600000}h, cleanup every ${CLEANUP_INTERVAL_MS / 3600000}h`);
}
function stopMatchingCron() {
    if (batchTimer) {
        clearInterval(batchTimer);
        batchTimer = null;
    }
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    console.log('[MatchingCron] Stopped.');
}
async function runBatchMatch() {
    try {
        console.log('[MatchingCron] Running scheduled batch match...');
        const result = await MatchingService_1.MatchingService.runMatchingEngine();
        console.log(`[MatchingCron] Batch complete — processed: ${result.processed}, new matches: ${result.totalMatches}`);
    }
    catch (err) {
        console.error('[MatchingCron] Batch match error:', err);
    }
}
async function runCleanup() {
    try {
        const count = await MatchingService_1.MatchingService.cleanupExpiredMatches();
        if (count > 0) {
            console.log(`[MatchingCron] Cleaned up ${count} expired matches`);
        }
    }
    catch (err) {
        console.error('[MatchingCron] Cleanup error:', err);
    }
}
//# sourceMappingURL=matchingCron.js.map