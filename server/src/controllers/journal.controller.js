import {
  createJournalEntryLogic,
  listJournalEntriesLogic,
  getJournalEntryLogic,
  updateJournalEntryLogic,
  deleteJournalEntryLogic,
} from '../services/journal.service.js';

export async function createJournalEntry(req, res, next) {
  try {
    const entry = await createJournalEntryLogic(req.auth.userId, req.validated);
    return res.status(201).json({ success: true, message: 'Journal entry created', data: { entry } });
  } catch (error) {
    return next(error);
  }
}

export async function listJournalEntries(req, res, next) {
  try {
    const result = await listJournalEntriesLogic(req.auth.userId, req.validatedQuery);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getJournalEntry(req, res, next) {
  try {
    const entry = await getJournalEntryLogic(req.auth.userId, req.params.id);
    return res.status(200).json({ success: true, data: { entry } });
  } catch (error) {
    return next(error);
  }
}

export async function updateJournalEntry(req, res, next) {
  try {
    const entry = await updateJournalEntryLogic(req.auth.userId, req.params.id, req.validated);
    return res.status(200).json({ success: true, message: 'Journal entry updated', data: { entry } });
  } catch (error) {
    return next(error);
  }
}

export async function deleteJournalEntry(req, res, next) {
  try {
    await deleteJournalEntryLogic(req.auth.userId, req.params.id);
    return res.status(200).json({ success: true, message: 'Journal entry deleted', data: {} });
  } catch (error) {
    return next(error);
  }
}
