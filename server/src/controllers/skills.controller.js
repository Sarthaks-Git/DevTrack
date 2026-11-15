import { getSkillsLogic } from '../services/skills.service.js';

export async function getSkills(req, res, next) {
  try {
    const data = await getSkillsLogic(req.auth.userId, req.validatedQuery.today);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
