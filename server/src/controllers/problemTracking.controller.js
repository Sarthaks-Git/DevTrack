import { syncLeetCodeLogic, listSolvedProblemsLogic, listProblemDaysLogic } from '../services/problemTracking.service.js';

export async function syncLeetCode(req, res) {
  const data = await syncLeetCodeLogic(req.user.id, req.body);
  return res.status(200).json({ success: true, data });
}

export async function listSolvedProblems(req, res) {
  const data = await listSolvedProblemsLogic(req.user.id, req.problemQuery);
  return res.status(200).json({ success: true, data });
}

export async function listProblemDays(req, res) {
  const data = await listProblemDaysLogic(req.user.id, req.dayRange);
  return res.status(200).json({ success: true, data });
}
