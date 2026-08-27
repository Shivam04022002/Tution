import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import { buildGeoNearStage, attachDistanceKm } from '../services/geoSearchService';
import {
  startTestDatabase,
  stopTestDatabase,
  clearCollections,
  destinationPoint,
  ORIGIN,
} from './helpers/geoTestUtils';

/**
 * These exercise the real models, the real 2dsphere indexes and the real
 * $geoNear stage — the same code path the API uses.
 *
 * Fixtures are saved with validateBeforeSave:false so a test only has to supply
 * the fields under test; the geoPoint sync hook still runs, which is the point.
 */

const TEACHER_BASE = {
  isActive: true,
  isVerified: true,
  isBlocked: false,
};

const createTeacher = async (options: {
  name: string;
  distanceKm?: number;
  bearingDeg?: number;
  subjects?: string[];
  classes?: string[];
  omitCoordinates?: boolean;
}) => {
  const point = options.omitCoordinates
    ? undefined
    : destinationPoint(
        ORIGIN.latitude,
        ORIGIN.longitude,
        options.distanceKm ?? 0,
        options.bearingDeg ?? 0
      );

  const teacher = new TeacherProfile({
    ...TEACHER_BASE,
    basicDetails: { fullName: options.name },
    teachingDetails: {
      subjects: options.subjects ?? ['Mathematics'],
      classes: options.classes ?? ['Class 8'],
    },
    locationAvailability: {
      address: 'Test address',
      city: 'Lucknow',
      pincode: '226010',
      ...(point ? { coordinates: point } : {}),
    },
  });

  await teacher.save({ validateBeforeSave: false });
  return teacher;
};

const createRequirement = async (options: {
  name: string;
  distanceKm?: number;
  subjects?: string[];
  grade?: string;
  omitCoordinates?: boolean;
}) => {
  const point = options.omitCoordinates
    ? undefined
    : destinationPoint(ORIGIN.latitude, ORIGIN.longitude, options.distanceKm ?? 0, 0);

  const requirement = new ParentRequirement({
    requirementId: options.name,
    status: 'active',
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subjects: options.subjects ?? ['Mathematics'],
    studentDetails: { grade: options.grade ?? 'Class 8' },
    location: {
      address: 'Test address',
      city: 'Lucknow',
      pincode: '226010',
      teachingRadius: 5,
      ...(point ? { coordinates: point } : {}),
    },
  });

  await requirement.save({ validateBeforeSave: false });
  return requirement;
};

/** Run the same aggregation the controllers run. */
const searchTeachers = async (radiusKm: number, extraQuery: Record<string, any> = {}) => {
  const rows = await TeacherProfile.aggregate([
    buildGeoNearStage({
      geo: { ...ORIGIN, radiusKm },
      path: 'locationAvailability.geoPoint',
      query: { ...TEACHER_BASE, ...extraQuery },
    }),
  ]);
  return attachDistanceKm(rows);
};

const searchRequirements = async (radiusKm: number, extraQuery: Record<string, any> = {}) => {
  const rows = await ParentRequirement.aggregate([
    buildGeoNearStage({
      geo: { ...ORIGIN, radiusKm },
      path: 'location.geoPoint',
      query: { status: 'active', isActive: true, ...extraQuery },
    }),
  ]);
  return attachDistanceKm(rows);
};

const names = (rows: any[]): string[] => rows.map((r) => r.basicDetails?.fullName ?? r.requirementId);

beforeAll(async () => {
  await startTestDatabase();

  // Create only the geospatial indexes under test. Model.createIndexes() would
  // also try to rebuild every other declared index, and TeacherProfile has a
  // pre-existing duplicate `userId` declaration (field-level `unique: true`
  // plus an explicit .index()) that makes the bulk call fail for reasons
  // unrelated to this feature.
  await TeacherProfile.collection.createIndex({ 'locationAvailability.geoPoint': '2dsphere' });
  await ParentRequirement.collection.createIndex({ 'location.geoPoint': '2dsphere' });
});

afterAll(stopTestDatabase);
afterEach(clearCollections);

describe('parent → nearby teachers', () => {
  beforeEach(async () => {
    await createTeacher({ name: 'Teacher A', distanceKm: 0.5 });
    await createTeacher({ name: 'Teacher B', distanceKm: 0.9 });
    await createTeacher({ name: 'Teacher C', distanceKm: 1.1 });
    await createTeacher({ name: 'Teacher D', distanceKm: 1.8 });
  });

  it('includes teachers inside 1 km and excludes those beyond it', async () => {
    const results = await searchTeachers(1);

    expect(names(results)).toEqual(['Teacher A', 'Teacher B']);
    expect(names(results)).not.toContain('Teacher C');
  });

  it('expands the result set at 1.5 km rather than returning only new results', async () => {
    const results = await searchTeachers(1.5);

    // A and B must still be present — this is a cumulative search.
    expect(names(results)).toEqual(['Teacher A', 'Teacher B', 'Teacher C']);
  });

  it('expands again at 2 km', async () => {
    const results = await searchTeachers(2);

    expect(names(results)).toEqual(['Teacher A', 'Teacher B', 'Teacher C', 'Teacher D']);
  });

  it('is strictly cumulative as the radius grows', async () => {
    const atOne = names(await searchTeachers(1));
    const atOneFive = names(await searchTeachers(1.5));
    const atTwo = names(await searchTeachers(2));

    expect(atOneFive).toEqual(expect.arrayContaining(atOne));
    expect(atTwo).toEqual(expect.arrayContaining(atOneFive));
    expect(atOne.length).toBeLessThanOrEqual(atOneFive.length);
    expect(atOneFive.length).toBeLessThanOrEqual(atTwo.length);
  });

  it('orders results nearest-first', async () => {
    const results = await searchTeachers(2);
    const distances = results.map((r) => r.distanceKm);

    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('returns a backend-calculated distance for each result', async () => {
    const results = await searchTeachers(2);

    expect(results[0].distanceKm).toBeCloseTo(0.5, 1);
    expect(results[1].distanceKm).toBeCloseTo(0.9, 1);
    expect(results[2].distanceKm).toBeCloseTo(1.1, 1);
    expect(results[3].distanceKm).toBeCloseTo(1.8, 1);
  });
});

describe('radius boundary behaviour', () => {
  it('includes a teacher just inside the boundary and excludes one just outside', async () => {
    await createTeacher({ name: 'Inside', distanceKm: 0.98 });
    await createTeacher({ name: 'Outside', distanceKm: 1.02 });

    const results = await searchTeachers(1);

    expect(names(results)).toEqual(['Inside']);
  });

  it('handles the boundary consistently in every compass direction', async () => {
    await createTeacher({ name: 'North', distanceKm: 0.9, bearingDeg: 0 });
    await createTeacher({ name: 'East', distanceKm: 0.9, bearingDeg: 90 });
    await createTeacher({ name: 'South', distanceKm: 0.9, bearingDeg: 180 });
    await createTeacher({ name: 'West', distanceKm: 0.9, bearingDeg: 270 });

    const results = await searchTeachers(1);

    // A latitude/longitude swap would drop the east/west pair out of range.
    expect(results).toHaveLength(4);
    results.forEach((r) => expect(r.distanceKm).toBeCloseTo(0.9, 1));
  });
});

describe('teacher → nearby students (reverse search)', () => {
  beforeEach(async () => {
    await createRequirement({ name: 'Requirement A', distanceKm: 0.5 });
    await createRequirement({ name: 'Requirement B', distanceKm: 0.9 });
    await createRequirement({ name: 'Requirement C', distanceKm: 1.1 });
    await createRequirement({ name: 'Requirement D', distanceKm: 1.8 });
  });

  it('behaves identically to the forward search at 1 km', async () => {
    expect(names(await searchRequirements(1))).toEqual(['Requirement A', 'Requirement B']);
  });

  it('expands at 1.5 km and 2 km', async () => {
    expect(names(await searchRequirements(1.5))).toEqual([
      'Requirement A',
      'Requirement B',
      'Requirement C',
    ]);
    expect(names(await searchRequirements(2))).toHaveLength(4);
  });

  it('orders requirements nearest-first with a calculated distance', async () => {
    const results = await searchRequirements(2);
    const distances = results.map((r) => r.distanceKm);

    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(results[0].distanceKm).toBeCloseTo(0.5, 1);
  });
});

describe('existing filters combined with the radius condition', () => {
  beforeEach(async () => {
    await createTeacher({ name: 'Maths Near', distanceKm: 0.5, subjects: ['Mathematics'] });
    await createTeacher({ name: 'Science Near', distanceKm: 0.6, subjects: ['Science'] });
    await createTeacher({ name: 'Maths Far', distanceKm: 1.8, subjects: ['Mathematics'] });
    await createTeacher({
      name: 'Maths Near Class 10',
      distanceKm: 0.7,
      subjects: ['Mathematics'],
      classes: ['Class 10'],
    });
  });

  it('applies the subject filter AND the radius together', async () => {
    const results = await searchTeachers(1, {
      'teachingDetails.subjects': { $in: ['Mathematics'] },
    });

    expect(names(results)).toEqual(['Maths Near', 'Maths Near Class 10']);
    expect(names(results)).not.toContain('Science Near'); // wrong subject
    expect(names(results)).not.toContain('Maths Far'); // outside radius
  });

  it('applies subject AND class AND radius together', async () => {
    const results = await searchTeachers(1, {
      'teachingDetails.subjects': { $in: ['Mathematics'] },
      'teachingDetails.classes': { $in: ['Class 10'] },
    });

    expect(names(results)).toEqual(['Maths Near Class 10']);
  });

  it('still honours the eligibility flags the existing search relies on', async () => {
    const blocked = await createTeacher({ name: 'Blocked Near', distanceKm: 0.4 });
    blocked.set('isBlocked', true);
    await blocked.save({ validateBeforeSave: false });

    expect(names(await searchTeachers(1))).not.toContain('Blocked Near');
  });
});

describe('records without usable coordinates', () => {
  it('does not crash the search and is simply omitted', async () => {
    await createTeacher({ name: 'Located', distanceKm: 0.5 });
    await createTeacher({ name: 'No Location', omitCoordinates: true });

    const results = await searchTeachers(2);

    expect(names(results)).toEqual(['Located']);
  });

  it('omits records whose coordinates are null island', async () => {
    await createTeacher({ name: 'Located', distanceKm: 0.5 });

    const nullIsland = new TeacherProfile({
      ...TEACHER_BASE,
      basicDetails: { fullName: 'Null Island' },
      locationAvailability: {
        address: 'a',
        city: 'b',
        pincode: '226010',
        coordinates: { latitude: 0, longitude: 0 },
      },
    });
    await nullIsland.save({ validateBeforeSave: false });

    expect(names(await searchTeachers(10))).toEqual(['Located']);
  });

  it('returns an empty list rather than erroring when nothing is in range', async () => {
    await createTeacher({ name: 'Far Away', distanceKm: 40 });

    await expect(searchTeachers(1)).resolves.toEqual([]);
  });
});

describe('geoPoint sync hook', () => {
  it('derives the GeoJSON point from coordinates on save', async () => {
    const teacher = await createTeacher({ name: 'Synced', distanceKm: 0 });
    const saved: any = await TeacherProfile.findById(teacher._id).lean();

    expect(saved.locationAvailability.geoPoint).toEqual({
      type: 'Point',
      coordinates: [ORIGIN.longitude, ORIGIN.latitude],
    });
  });

  it('re-derives the point when the address is moved', async () => {
    const teacher = await createTeacher({ name: 'Mover', distanceKm: 0 });
    const moved = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, 5, 90);

    teacher.set('locationAvailability.coordinates', moved);
    await teacher.save({ validateBeforeSave: false });

    const saved: any = await TeacherProfile.findById(teacher._id).lean();
    expect(saved.locationAvailability.geoPoint.coordinates[0]).toBeCloseTo(moved.longitude, 4);
    expect(saved.locationAvailability.geoPoint.coordinates[1]).toBeCloseTo(moved.latitude, 4);

    // And the moved teacher is now findable at the new place, not the old one.
    expect(names(await searchTeachers(1))).not.toContain('Mover');
  });

  it('keeps geoPoint in sync through an atomic update', async () => {
    const teacher = await createTeacher({ name: 'Updated', distanceKm: 0 });
    const moved = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, 3, 180);

    await TeacherProfile.updateOne(
      { _id: teacher._id },
      { $set: { 'locationAvailability.coordinates': moved } }
    );

    const saved: any = await TeacherProfile.findById(teacher._id).lean();
    expect(saved.locationAvailability.geoPoint.coordinates[0]).toBeCloseTo(moved.longitude, 4);
    expect(saved.locationAvailability.geoPoint.coordinates[1]).toBeCloseTo(moved.latitude, 4);
  });

  it('stores an eastern longitude the old legacy-pair index could not accept', async () => {
    const guwahati = { latitude: 26.1445, longitude: 91.7362 };

    const teacher = new TeacherProfile({
      ...TEACHER_BASE,
      basicDetails: { fullName: 'Assam Teacher' },
      locationAvailability: {
        address: 'a',
        city: 'Guwahati',
        pincode: '781001',
        coordinates: guwahati,
      },
    });

    await expect(teacher.save({ validateBeforeSave: false })).resolves.toBeDefined();

    const rows = await TeacherProfile.aggregate([
      buildGeoNearStage({
        geo: { ...guwahati, radiusKm: 1 },
        path: 'locationAvailability.geoPoint',
        query: TEACHER_BASE,
      }),
    ]);

    expect(names(rows)).toEqual(['Assam Teacher']);
  });
});
