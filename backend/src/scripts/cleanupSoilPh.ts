import { connectDB, disconnectDB } from '../db/connection';
import { EnvironmentalContext } from '../models';

async function cleanupSoilPhInDB() {
  console.log('Connecting to MongoDB to inspect EnvironmentalContext documents...');
  await connectDB();

  const collection = EnvironmentalContext.collection;
  const docs = await collection.find({}).toArray();
  console.log(`Found ${docs.length} total EnvironmentalContext documents.`);

  let modifiedCount = 0;

  for (const doc of docs) {
    let needsUpdate = false;
    const updateObj: Record<string, any> = {};
    const unsetObj: Record<string, any> = {};

    if (doc.soil && typeof doc.soil === 'object') {
      if ('pH' in doc.soil) {
        needsUpdate = true;
        unsetObj['soil.pH'] = '';
        // If canonical ph is missing but non-canonical pH was present, preserve the value in canonical ph
        if (doc.soil.ph === undefined || doc.soil.ph === null) {
          updateObj['soil.ph'] = doc.soil.pH;
        }
      }
    }

    if (doc.fieldSources && typeof doc.fieldSources === 'object') {
      if ('soil.pH' in doc.fieldSources) {
        needsUpdate = true;
        const cleanFieldSources = { ...doc.fieldSources };
        if (!cleanFieldSources['soil.ph']) {
          cleanFieldSources['soil.ph'] = cleanFieldSources['soil.pH'];
        }
        delete cleanFieldSources['soil.pH'];
        updateObj.fieldSources = cleanFieldSources;
      }
    }

    if (needsUpdate) {
      const mongoUpdate: Record<string, any> = {};
      if (Object.keys(updateObj).length > 0) {
        mongoUpdate.$set = updateObj;
      }
      if (Object.keys(unsetObj).length > 0) {
        mongoUpdate.$unset = unsetObj;
      }

      await collection.updateOne({ _id: doc._id }, mongoUpdate);
      modifiedCount++;
      console.log(`Cleaned document ${doc._id}: preserved soil.ph, removed soil.pH`);
    }
  }

  console.log(`\nCleanup complete. Modified ${modifiedCount} documents.`);

  // Verify that zero documents now contain soil.pH
  const remainingWithSoilPH = await collection.countDocuments({ 'soil.pH': { $exists: true } });
  const remainingWithFieldSourcePH = await collection.countDocuments({ 'fieldSources.soil.pH': { $exists: true } });
  console.log(`Verification: documents with soil.pH = ${remainingWithSoilPH}`);
  console.log(`Verification: documents with fieldSources.soil.pH = ${remainingWithFieldSourcePH}`);

  await disconnectDB();
}

cleanupSoilPhInDB().catch((err) => {
  console.error('Cleanup script error:', err);
  process.exit(1);
});
