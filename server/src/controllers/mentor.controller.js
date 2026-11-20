import { suggestProjectIdeasLogic } from '../services/projectIdeas.service.js';
import { getReviewNoteLogic, writeReviewNoteLogic } from '../services/weeklyReviewNote.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export async function suggestProjectIdeas(req, res, next) {
  try {
    return ok(res, await suggestProjectIdeasLogic(req.auth.userId, req.params.id));
  } catch (error) {
    return next(error);
  }
}

export async function getWeeklyReviewNote(req, res, next) {
  try {
    return ok(res, await getReviewNoteLogic(req.auth.userId, req.validatedQuery));
  } catch (error) {
    return next(error);
  }
}

export async function writeWeeklyReviewNote(req, res, next) {
  try {
    return ok(res, await writeReviewNoteLogic(req.auth.userId, req.validatedQuery), 201);
  } catch (error) {
    return next(error);
  }
}
