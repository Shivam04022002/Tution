import { TeacherProfile } from '../models/TeacherProfile';
import { buildFilterQuery } from '../controllers/tutorFilterController';
import { startTestDatabase, stopTestDatabase, clearCollections } from './helpers/geoTestUtils';

/**
 * Regression coverage for GET /api/teachers/filter.
 *
 * The Parent "Find Tutor" screen sends the free-text query and every structured
 * filter to this one endpoint, so they must combine with AND semantics. A text
 * match must never be able to smuggle in a tutor who fails the subject/class
 * filters, and vice versa.
 */

const BASE = { isActive: true, isVerified: true, isBlocked: false };

const createTeacher = async (options: {
  name: string;
  subjects?: string[];
  classes?: string[];
  city?: string;
  area?: string;
  bio?: string;
}) => {
  const teacher = new TeacherProfile({
    ...BASE,
    basicDetails: { fullName: options.name, languages: ['English'] },
    teachingDetails: {
      subjects: options.subjects ?? ['Mathematics'],
      classes: options.classes ?? ['Class 10'],
    },
    locationAvailability: {
      address: options.area ?? 'Some address',
      city: options.city ?? 'Lucknow',
      pincode: '226010',
      preferredAreas: options.area ? [options.area] : [],
      coordinates: { latitude: 26.8467, longitude: 80.9462 },
    },
    bio: options.bio,
  });

  await teacher.save({ validateBeforeSave: false });
  return teacher;
};

const runFilter = async (params: Parameters<typeof buildFilterQuery>[0]) => {
  const rows = await TeacherProfile.find(buildFilterQuery(params)).lean();
  return rows.map((r: any) => r.basicDetails?.fullName).sort();
};

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
afterEach(clearCollections);

describe('free-text query (q)', () => {
  beforeEach(async () => {
    await createTeacher({ name: 'Anita Sharma', subjects: ['Mathematics'] });
    await createTeacher({ name: 'Rahul Verma', subjects: ['Physics'] });
    await createTeacher({ name: 'Priya Nair', subjects: ['Chemistry'], city: 'Kanpur' });
  });

  it('is optional — omitting it returns every eligible tutor', async () => {
    expect(await runFilter({})).toEqual(['Anita Sharma', 'Priya Nair', 'Rahul Verma']);
  });

  it('matches on tutor name', async () => {
    expect(await runFilter({ q: 'Anita' })).toEqual(['Anita Sharma']);
  });

  it('matches on subject', async () => {
    expect(await runFilter({ q: 'Physics' })).toEqual(['Rahul Verma']);
  });

  it('matches on city', async () => {
    expect(await runFilter({ q: 'Kanpur' })).toEqual(['Priya Nair']);
  });

  it('is case-insensitive', async () => {
    expect(await runFilter({ q: 'anita' })).toEqual(['Anita Sharma']);
  });

  it('returns nothing when the text matches no one', async () => {
    expect(await runFilter({ q: 'Nonexistent' })).toEqual([]);
  });

  it('still applies the eligibility flags', async () => {
    const blocked = await createTeacher({ name: 'Anita Blocked' });
    blocked.set('isBlocked', true);
    await blocked.save({ validateBeforeSave: false });

    expect(await runFilter({ q: 'Anita' })).toEqual(['Anita Sharma']);
  });
});

describe('text query combined with structured filters', () => {
  beforeEach(async () => {
    await createTeacher({ name: 'Maths Ten', subjects: ['Mathematics'], classes: ['Class 10'] });
    await createTeacher({ name: 'Maths Eight', subjects: ['Mathematics'], classes: ['Class 8'] });
    await createTeacher({ name: 'Physics Ten', subjects: ['Physics'], classes: ['Class 10'] });
  });

  it('ANDs the text query with the subject filter', async () => {
    // "Ten" matches two tutors by name; the subject filter must narrow it to one.
    expect(await runFilter({ q: 'Ten', subjects: 'Mathematics' })).toEqual(['Maths Ten']);
  });

  it('ANDs the text query with subject AND class together', async () => {
    expect(
      await runFilter({ q: 'Maths', subjects: 'Mathematics', classes: 'Class 8' }),
    ).toEqual(['Maths Eight']);
  });

  it('does not let a text match bypass a structured filter', async () => {
    // 'Physics Ten' matches the text, but fails the subject filter.
    const names = await runFilter({ q: 'Physics', subjects: 'Mathematics' });
    expect(names).toEqual([]);
  });

  it('does not let a structured match bypass the text query', async () => {
    const names = await runFilter({ q: 'Nonexistent', subjects: 'Mathematics' });
    expect(names).toEqual([]);
  });
});

describe('text query does not collide with the area filter', () => {
  beforeEach(async () => {
    await createTeacher({ name: 'Gomti Teacher', subjects: ['Mathematics'], area: 'Gomti Nagar' });
    await createTeacher({ name: 'Hazratganj Teacher', subjects: ['Physics'], area: 'Hazratganj' });
  });

  it('keeps AND semantics when both area and q are supplied', async () => {
    // `area` owns the top-level $or; `q` is pushed onto $and. If they shared
    // $or, an area match alone would satisfy the query and return both.
    const names = await runFilter({ area: 'Gomti', q: 'Gomti' });
    expect(names).toEqual(['Gomti Teacher']);
  });

  it('area + a non-matching q returns nothing rather than the area matches', async () => {
    expect(await runFilter({ area: 'Gomti', q: 'Nonexistent' })).toEqual([]);
  });

  it('builds separate $and and $or branches', () => {
    const query = buildFilterQuery({ area: 'Gomti', q: 'Physics' });

    expect(Array.isArray(query.$or)).toBe(true);   // area
    expect(Array.isArray(query.$and)).toBe(true);  // text
    expect(query.$and[0].$or.length).toBeGreaterThan(1);
  });
});

describe('text query is escaped before becoming a RegExp', () => {
  beforeEach(async () => {
    await createTeacher({ name: 'A.B Tutor' });
    await createTeacher({ name: 'AXB Tutor' });
  });

  it('treats "." literally rather than as a wildcard', async () => {
    expect(await runFilter({ q: 'A.B' })).toEqual(['A.B Tutor']);
  });

  it('does not throw on regex metacharacters', async () => {
    await expect(runFilter({ q: '(((' })).resolves.toEqual([]);
    await expect(runFilter({ q: '[' })).resolves.toEqual([]);
    await expect(runFilter({ q: '*' })).resolves.toEqual([]);
  });
});

describe('existing filters are unchanged', () => {
  beforeEach(async () => {
    await createTeacher({ name: 'Maths Lucknow', subjects: ['Mathematics'], city: 'Lucknow' });
    await createTeacher({ name: 'Physics Kanpur', subjects: ['Physics'], city: 'Kanpur' });
  });

  it('subject filter still works on its own', async () => {
    expect(await runFilter({ subjects: 'Mathematics' })).toEqual(['Maths Lucknow']);
  });

  it('city filter still works on its own', async () => {
    expect(await runFilter({ city: 'Kanpur' })).toEqual(['Physics Kanpur']);
  });

  it('multi-select subjects still ORs within the filter', async () => {
    expect(await runFilter({ subjects: 'Mathematics,Physics' })).toEqual([
      'Maths Lucknow',
      'Physics Kanpur',
    ]);
  });
});
