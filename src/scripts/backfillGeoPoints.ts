import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import { toGeoPoint } from '../models/geoPointSync';

dotenv.config();

/**
 * Backfill the derived `geoPoint` field on documents created before the
 * geospatial search feature existed.
 *
 * Safe to re-run: documents that already have a correct geoPoint are skipped.
 * Documents with missing or unusable coordinates are reported and left alone —
 * they simply do not appear in nearby searches.
 *
 *   Dry run (default, writes nothing):
 *     npx ts-node src/scripts/backfillGeoPoints.ts
 *   Apply:
 *     npx ts-node src/scripts/backfillGeoPoints.ts --apply
 */

interface BackfillStats {
  scanned: number;
  updated: number;
  alreadyCorrect: number;
  skippedNoCoordinates: number;
}

const isSamePoint = (existing: any, next: { coordinates: [number, number] }): boolean =>
  Array.isArray(existing?.coordinates) &&
  existing.coordinates.length === 2 &&
  existing.coordinates[0] === next.coordinates[0] &&
  existing.coordinates[1] === next.coordinates[1];

const backfillCollection = async (options: {
  label: string;
  model: mongoose.Model<any>;
  sourcePath: string;
  targetPath: string;
  apply: boolean;
}): Promise<BackfillStats> => {
  const { label, model, sourcePath, targetPath, apply } = options;
  const stats: BackfillStats = {
    scanned: 0,
    updated: 0,
    alreadyCorrect: 0,
    skippedNoCoordinates: 0,
  };

  const getPath = (doc: any, path: string) =>
    path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), doc);

  // Stream rather than load everything into memory — this runs against a
  // production collection.
  const cursor = model
    .find({}, { [sourcePath]: 1, [targetPath]: 1 })
    .lean()
    .cursor();

  const bulk: mongoose.AnyBulkWriteOperation[] = [];

  for await (const doc of cursor) {
    stats.scanned += 1;

    const source = getPath(doc, sourcePath);
    const point = toGeoPoint(source?.latitude, source?.longitude);

    if (!point) {
      stats.skippedNoCoordinates += 1;
      continue;
    }

    const existing = getPath(doc, targetPath);
    if (isSamePoint(existing, point)) {
      stats.alreadyCorrect += 1;
      continue;
    }

    stats.updated += 1;

    if (apply) {
      bulk.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: { $set: { [targetPath]: point } },
        },
      });

      if (bulk.length >= 500) {
        await model.bulkWrite(bulk);
        bulk.length = 0;
      }
    }
  }

  if (apply && bulk.length > 0) {
    await model.bulkWrite(bulk);
  }

  console.log(
    `[${label}] scanned=${stats.scanned} ` +
      `${apply ? 'updated' : 'would update'}=${stats.updated} ` +
      `alreadyCorrect=${stats.alreadyCorrect} ` +
      `skippedNoCoordinates=${stats.skippedNoCoordinates}`
  );

  return stats;
};

const run = async () => {
  const apply = process.argv.includes('--apply');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  console.log(apply ? '=== APPLYING geoPoint backfill ===' : '=== DRY RUN (pass --apply to write) ===');

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    await backfillCollection({
      label: 'TeacherProfile',
      model: TeacherProfile as unknown as mongoose.Model<any>,
      sourcePath: 'locationAvailability.coordinates',
      targetPath: 'locationAvailability.geoPoint',
      apply,
    });

    await backfillCollection({
      label: 'ParentRequirement',
      model: ParentRequirement as unknown as mongoose.Model<any>,
      sourcePath: 'location.coordinates',
      targetPath: 'location.geoPoint',
      apply,
    });

    if (apply) {
      // Building the 2dsphere indexes after the data is in place avoids a
      // partially-populated index.
      console.log('Synchronising indexes…');
      await TeacherProfile.syncIndexes();
      await ParentRequirement.syncIndexes();
      console.log('Indexes synchronised.');
    } else {
      console.log('Dry run complete — no documents or indexes were modified.');
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
