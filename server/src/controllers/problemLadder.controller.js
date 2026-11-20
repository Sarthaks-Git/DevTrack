import { createLadderLogic, deleteLadderLogic, listLaddersLogic } from '../services/problemLadder.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export async function listLadders(req, res, next) {
  try {
    return ok(res, await listLaddersLogic(req.auth.userId, req.validatedQuery.today));
  } catch (error) {
    return next(error);
  }
}

export async function createLadder(req, res, next) {
  try {
    return ok(res, await createLadderLogic(req.auth.userId, req.validatedPattern, new Date(new Date().toISOString().slice(0, 10))), 201);
  } catch (error) {
    return next(error);
  }
}

export async function deleteLadder(req, res, next) {
  try {
    await deleteLadderLogic(req.auth.userId, req.params.id);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
