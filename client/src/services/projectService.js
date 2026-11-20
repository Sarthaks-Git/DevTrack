import api from './api';
export async function getProjects() { const { data } = await api.get('/projects'); return data; }
export async function createProject(projectData) { const { data } = await api.post('/projects', projectData); return data; }
export async function getProject(projectId) { const { data } = await api.get(`/projects/${projectId}`); return data; }
export async function updateProject(projectId, projectData) { const { data } = await api.patch(`/projects/${projectId}`, projectData); return data; }
export async function deleteProject(projectId) { const { data } = await api.delete(`/projects/${projectId}`); return data; }
export async function addProjectMilestone(projectId, milestone) { const { data } = await api.post(`/projects/${projectId}/milestones`, milestone); return data.data.project; }
export async function updateProjectMilestone(projectId, milestoneId, changes) { const { data } = await api.patch(`/projects/${projectId}/milestones/${milestoneId}`, changes); return data.data.project; }
export async function deleteProjectMilestone(projectId, milestoneId) { const { data } = await api.delete(`/projects/${projectId}/milestones/${milestoneId}`); return data.data.project; }
export async function addProjectMilestones(projectId, milestones) { const { data } = await api.post(`/projects/${projectId}/milestones/bulk`, { milestones }); return data.data.project; }
