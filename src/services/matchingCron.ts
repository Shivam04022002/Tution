import { MatchingService } from './MatchingService';

// ─── Intervals ────────────────────────────────────────────────────────────────
// Full batch match recalculation — every 6 hours
const BATCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Expired-match cleanup — every 1 hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let batchTimer: ReturnType<typeof setInterval> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startMatchingCron(): void {
  if (batchTimer || cleanupTimer) {
    console.log('[MatchingCron] Already running, skipping start.');
    return;
  }

  console.log('[MatchingCron] Starting cron jobs...');

  // Run immediately on startup
  runBatchMatch();
  runCleanup();

  // Then on interval
  batchTimer = setInterval(runBatchMatch, BATCH_INTERVAL_MS);
  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  console.log(`[MatchingCron] Batch match every ${BATCH_INTERVAL_MS / 3600000}h, cleanup every ${CLEANUP_INTERVAL_MS / 3600000}h`);
}

export function stopMatchingCron(): void {
  if (batchTimer) { clearInterval(batchTimer); batchTimer = null; }
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
  console.log('[MatchingCron] Stopped.');
}

async function runBatchMatch(): Promise<void> {
  try {
    console.log('[MatchingCron] Running scheduled batch match...');
    const result = await MatchingService.runMatchingEngine();
    console.log(`[MatchingCron] Batch complete — processed: ${result.processed}, new matches: ${result.totalMatches}`);
  } catch (err) {
    console.error('[MatchingCron] Batch match error:', err);
  }
}

async function runCleanup(): Promise<void> {
  try {
    const count = await MatchingService.cleanupExpiredMatches();
    if (count > 0) {
      console.log(`[MatchingCron] Cleaned up ${count} expired matches`);
    }
  } catch (err) {
    console.error('[MatchingCron] Cleanup error:', err);
  }
}
