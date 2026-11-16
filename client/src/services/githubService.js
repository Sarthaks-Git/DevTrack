import api from './api';

const BASE = '/integrations/github';

export async function getGitHubStatus() { const { data } = await api.get(BASE); return data.data; }
export async function startGitHubConnect() { const { data } = await api.post(`${BASE}/connect`, {}); return data.data.authorizeUrl; }
export async function listGitHubRepos() { const { data } = await api.get(`${BASE}/repos`); return data.data; }
// manual: "Sync now". Without it the server treats the call as an automatic sync and throttles it harder.
export async function syncGitHub(manual = false) { const { data } = await api.post(`${BASE}/sync`, manual ? { manual: true } : {}); return data.data; }
export async function disconnectGitHub() { await api.delete(BASE); }
export async function linkRepository(projectId, repoId) { const { data } = await api.put(`/projects/${projectId}/repository`, { repoId }); return data.data.repository; }
export async function unlinkRepository(projectId) { await api.delete(`/projects/${projectId}/repository`); }
export async function getProjectCommits(projectId) { const { data } = await api.get(`/projects/${projectId}/commits`); return data.data; }
