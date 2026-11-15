import { addMilestoneLogic, updateMilestoneLogic, deleteMilestoneLogic } from '../services/milestone.service.js';

// Each parent keeps its own response shape: goals use the legacy `{ goal }` envelope,
// projects use `{ success, data: { project } }` (see docs/API.md).
const RESPOND = {
  goal: (res, status, message, goal) => res.status(status).json({ message, goal }),
  project: (res, status, message, project) => res.status(status).json({ success: true, message, data: { project } }),
};

export function milestoneControllers(kind) {
  const respond = RESPOND[kind];
  return {
    async add(req, res) {
      const doc = await addMilestoneLogic(kind, req.user.id, req.params.id, req.body);
      return respond(res, 201, 'Milestone added', doc);
    },
    async update(req, res) {
      const doc = await updateMilestoneLogic(kind, req.user.id, req.params.id, req.params.milestoneId, req.body);
      return respond(res, 200, 'Milestone updated', doc);
    },
    async remove(req, res) {
      const doc = await deleteMilestoneLogic(kind, req.user.id, req.params.id, req.params.milestoneId);
      return respond(res, 200, 'Milestone deleted', doc);
    },
  };
}
