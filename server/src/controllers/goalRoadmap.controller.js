import { suggestRoadmapLogic } from '../services/goalRoadmap.service.js';
import { createQuizLogic, getQuizLogic, submitAttemptLogic } from '../services/goalQuiz.service.js';

export async function suggestRoadmap(req, res, next) {
  try {
    return res.json({ success: true, data: await suggestRoadmapLogic(req.auth.userId, req.params.id) });
  } catch (error) {
    return next(error);
  }
}

export async function getQuiz(req, res, next) {
  try {
    return res.json({ success: true, data: await getQuizLogic(req.auth.userId, req.params.id) });
  } catch (error) {
    return next(error);
  }
}

export async function createQuiz(req, res, next) {
  try {
    return res.status(201).json({ success: true, data: await createQuizLogic(req.auth.userId, req.params.id) });
  } catch (error) {
    return next(error);
  }
}

export async function submitQuizAttempt(req, res, next) {
  try {
    return res.json({ success: true, data: await submitAttemptLogic(req.auth.userId, req.params.id, req.validatedAnswers) });
  } catch (error) {
    return next(error);
  }
}
