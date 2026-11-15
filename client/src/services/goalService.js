import api from './api';
export async function getGoals() { const { data } = await api.get('/goals'); return data; }
export async function createGoal(goalData) { const { data } = await api.post('/goals', goalData); return data; }
export async function updateGoal(goalId, goalData) { const { data } = await api.patch(`/goals/${goalId}`, goalData); return data; }
export async function deleteGoal(goalId) { const { data } = await api.delete(`/goals/${goalId}`); return data; }
export async function addGoalMilestone(goalId, milestone) { const { data } = await api.post(`/goals/${goalId}/milestones`, milestone); return data.goal; }
export async function updateGoalMilestone(goalId, milestoneId, changes) { const { data } = await api.patch(`/goals/${goalId}/milestones/${milestoneId}`, changes); return data.goal; }
export async function deleteGoalMilestone(goalId, milestoneId) { const { data } = await api.delete(`/goals/${goalId}/milestones/${milestoneId}`); return data.goal; }
