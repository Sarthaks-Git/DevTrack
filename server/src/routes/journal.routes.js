import { Router } from 'express';
import {
  createJournalEntry,
  listJournalEntries,
  getJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '../controllers/journal.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';
import { validateCreateJournalEntry, validateUpdateJournalEntry, validateJournalQuery } from '../validators/journal.validator.js';

const journalRouter = Router();
journalRouter.use(authMiddleware);
journalRouter.get('/', validateJournalQuery, listJournalEntries);
journalRouter.post('/', requireCsrf, validateCreateJournalEntry, createJournalEntry);
journalRouter.get('/:id', validateObjectId('id'), getJournalEntry);
journalRouter.patch('/:id', requireCsrf, validateObjectId('id'), validateUpdateJournalEntry, updateJournalEntry);
journalRouter.delete('/:id', requireCsrf, validateObjectId('id'), deleteJournalEntry);
export default journalRouter;
