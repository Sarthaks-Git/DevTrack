import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import '../src/app.js';
import User from '../src/models/User.js';
import { OWNED_MODELS } from '../src/services/account.service.js';
import { createSession, PASSWORD } from './helpers.js';

const MODELS_DIR = new URL('../src/models/', import.meta.url);

// Register every model file, so a model the app does not import yet is still checked.
async function loadAllModels() {
  const files = readdirSync(MODELS_DIR).filter(name => name.endsWith('.js'));
  await Promise.all(files.map(name => import(new URL(name, MODELS_DIR).href)));
  return Object.values(mongoose.models);
}

// Fields in a unique index (other than owner) get random values so two seeded rows never collide.
function uniqueFieldValues(Model) {
  const values = {};
  for (const [fields, options] of Model.schema.indexes()) {
    if (!options?.unique) continue;
    for (const field of Object.keys(fields)) {
      if (field !== 'owner') values[field] = randomBytes(8).toString('hex');
    }
  }
  return values;
}

// Raw insert, bypassing validation: the test is about deletion reaching every collection.
async function seedOwnedRows(ownerId) {
  for (const Model of OWNED_MODELS) {
    if (await Model.collection.countDocuments({ owner: ownerId })) continue;
    await Model.collection.insertOne({ ...uniqueFieldValues(Model), owner: ownerId });
  }
}

const countsFor = ownerId => Promise.all(OWNED_MODELS.map(Model => Model.collection.countDocuments({ owner: ownerId })));

describe('Account deletion coverage', () => {
  it('lists every model that stores an owner for deletion', async () => {
    const models = await loadAllModels();
    const owned = models.filter(Model => Model.schema.path('owner'));
    const missing = owned.filter(Model => !OWNED_MODELS.includes(Model)).map(Model => Model.modelName);
    expect(missing).toEqual([]);
    expect(owned.length).toBe(OWNED_MODELS.length);
  });

  it('removes the user and their rows from every owned collection, and nothing of anyone else', async () => {
    const session = await createSession('wipe');
    const bystander = await createSession('wipe');
    const userId = new mongoose.Types.ObjectId(session.userId);
    const bystanderId = new mongoose.Types.ObjectId(bystander.userId);
    await seedOwnedRows(userId);
    await seedOwnedRows(bystanderId);

    expect((await countsFor(userId)).every(count => count > 0)).toBe(true);
    const bystanderBefore = await countsFor(bystanderId);

    const res = await session.del('/api/auth/account').send({ currentPassword: PASSWORD, confirmation: 'DELETE' });
    expect(res.status).toBe(204);

    const after = await countsFor(userId);
    const leftovers = OWNED_MODELS.filter((Model, index) => after[index] > 0).map(Model => Model.modelName);
    expect(leftovers).toEqual([]);
    expect(await User.exists({ _id: userId })).toBeNull();

    expect(await countsFor(bystanderId)).toEqual(bystanderBefore);
    expect(await User.exists({ _id: bystanderId })).not.toBeNull();
    expect((await bystander.get('/api/auth/me')).status).toBe(200);
  });
});
