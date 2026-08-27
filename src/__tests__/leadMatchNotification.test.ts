import mongoose from 'mongoose';
import { TutorMatch } from '../models/TutorMatch';
import { Notification } from '../models/Notification';
import { DeviceToken } from '../models/DeviceToken';
import { startTestDatabase, stopTestDatabase, clearCollections } from './helpers/geoTestUtils';

const sendEachForMulticast = jest.fn();

jest.mock('../config/firebase', () => ({
  getMessaging: () => ({ sendEachForMulticast }),
  isFirebaseReady: () => true,
}));

import { MatchingService } from '../services/MatchingService';
import { registerDeviceToken } from '../services/pushService';

/**
 * End-to-end coverage of a real business event:
 *   new teacher/requirement match  →  notification record  →  FCM push
 *
 * The important property is idempotency. The batch engine re-runs every six
 * hours and on every server start, so a teacher must be told about a lead
 * exactly once.
 */

const REQUIREMENT_ID = new mongoose.Types.ObjectId();
const PARENT_ID = new mongoose.Types.ObjectId();
const TEACHER_A = new mongoose.Types.ObjectId();
const TEACHER_B = new mongoose.Types.ObjectId();

// TutorMatch requires every component score; matchId is filled by the model's
// own pre('validate') hook.
const buildMatch = (teacherId: mongoose.Types.ObjectId) =>
  ({
    requirementId: REQUIREMENT_ID,
    teacherId,
    teacherProfileId: new mongoose.Types.ObjectId(),
    parentId: PARENT_ID,
    overallScore: 82,
    breakdown: {
      subjectScore: 100,
      classScore: 100,
      boardScore: 80,
      locationScore: 90,
      budgetScore: 70,
      modeScore: 100,
      timingScore: 60,
    },
  }) as any;

beforeAll(async () => {
  await startTestDatabase();
  // The idempotency guarantee lives in this unique index.
  await TutorMatch.collection.createIndex({ requirementId: 1, teacherId: 1 }, { unique: true });
});

afterAll(stopTestDatabase);

beforeEach(() => {
  sendEachForMulticast.mockReset();
  sendEachForMulticast.mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    responses: [{ success: true }],
  });
});

afterEach(clearCollections);

describe('saveMatches idempotency', () => {
  it('reports a match as new only the first time it is saved', async () => {
    const first = await MatchingService.saveMatches([buildMatch(TEACHER_A)]);
    expect(first).toHaveLength(1);

    const second = await MatchingService.saveMatches([buildMatch(TEACHER_A)]);
    expect(second).toHaveLength(0);

    expect(await TutorMatch.countDocuments({ requirementId: REQUIREMENT_ID })).toBe(1);
  });

  it('distinguishes a genuinely new teacher from an already-matched one', async () => {
    await MatchingService.saveMatches([buildMatch(TEACHER_A)]);

    const created = await MatchingService.saveMatches([
      buildMatch(TEACHER_A),
      buildMatch(TEACHER_B),
    ]);

    expect(created).toHaveLength(1);
    expect(created[0].teacherId.toString()).toBe(TEACHER_B.toString());
  });
});

describe('new lead match → notification → push', () => {
  const requirement = {
    _id: REQUIREMENT_ID,
    requirementId: 'REQ-001',
    subjects: ['Mathematics'],
    studentDetails: { grade: 'Class 8' },
    location: { city: 'Lucknow' },
  } as any;

  it('notifies each newly matched teacher exactly once, and pushes to their device', async () => {
    await registerDeviceToken({ userId: TEACHER_A, token: 'fcm-teacher-a-000000000000000000' });

    const created = await MatchingService.saveMatches([buildMatch(TEACHER_A)]);
    await (MatchingService as any).notifyNewMatches(requirement, created);

    const notes = await Notification.find({ userId: TEACHER_A });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('NEW_LEAD_MATCH');
    expect(notes[0].isRead).toBe(false);
    expect(notes[0].body).toContain('Mathematics');
    expect(notes[0].entityId?.toString()).toBe(REQUIREMENT_ID.toString());

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const { data } = sendEachForMulticast.mock.calls[0][0];
    expect(data.type).toBe('NEW_LEAD_MATCH');
    expect(data.screen).toBe('Leads');
    expect(data.notificationId).toBe(String(notes[0]._id));
  });

  it('does not re-notify on a repeat batch run', async () => {
    await registerDeviceToken({ userId: TEACHER_A, token: 'fcm-teacher-a-000000000000000000' });

    const run1 = await MatchingService.saveMatches([buildMatch(TEACHER_A)]);
    await (MatchingService as any).notifyNewMatches(requirement, run1);

    // Six hours later, the cron runs the same requirement again.
    const run2 = await MatchingService.saveMatches([buildMatch(TEACHER_A)]);
    await (MatchingService as any).notifyNewMatches(requirement, run2);

    expect(await Notification.countDocuments({ userId: TEACHER_A })).toBe(1);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
  });

  it('gives each matched teacher their own record and their own push', async () => {
    await registerDeviceToken({ userId: TEACHER_A, token: 'fcm-teacher-a-000000000000000000' });
    await registerDeviceToken({ userId: TEACHER_B, token: 'fcm-teacher-b-111111111111111111' });

    const created = await MatchingService.saveMatches([
      buildMatch(TEACHER_A),
      buildMatch(TEACHER_B),
    ]);
    await (MatchingService as any).notifyNewMatches(requirement, created);

    expect(await Notification.countDocuments({ userId: TEACHER_A })).toBe(1);
    expect(await Notification.countDocuments({ userId: TEACHER_B })).toBe(1);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
  });

  it('still records the match when push delivery fails', async () => {
    await registerDeviceToken({ userId: TEACHER_A, token: 'fcm-teacher-a-000000000000000000' });
    sendEachForMulticast.mockRejectedValue(new Error('FCM unavailable'));

    const created = await MatchingService.saveMatches([buildMatch(TEACHER_A)]);
    await expect(
      (MatchingService as any).notifyNewMatches(requirement, created),
    ).resolves.toBeUndefined();

    // The business outcome survives a notification failure.
    expect(await TutorMatch.countDocuments({ requirementId: REQUIREMENT_ID })).toBe(1);
    expect(await Notification.countDocuments({ userId: TEACHER_A })).toBe(1);
  });

  it('handles a matched teacher who has no registered device', async () => {
    await DeviceToken.deleteMany({});

    const created = await MatchingService.saveMatches([buildMatch(TEACHER_A)]);
    await (MatchingService as any).notifyNewMatches(requirement, created);

    // In-app history still works without a device.
    expect(await Notification.countDocuments({ userId: TEACHER_A })).toBe(1);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });
});
