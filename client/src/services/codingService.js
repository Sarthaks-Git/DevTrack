import api from './api';
import { localDayKey } from '../utils/localDay';
export async function getCodingProfiles() { const { data } = await api.get('/coding-profiles'); return data; }
export async function startLeetCodeVerification(username) { const { data } = await api.post('/coding-profiles/verification/start', { platform: 'leetcode', username }); return data; }
export async function verifyLeetCodeProfile(token) { const { data } = await api.post('/coding-profiles/verification/verify', { platform: 'leetcode', token }); return data; }
export async function refreshLeetCodeStats() { const { data } = await api.post('/coding-profiles/leetcode/stats/refresh'); return data; }
export async function disconnectLeetCodeProfile() { const { data } = await api.delete('/coding-profiles/leetcode'); return data; }
// Problem tracking: the server throttles automatic syncs; force is for the Refresh button.
export async function syncLeetCode(force = false) { const { data } = await api.post('/coding-profiles/leetcode/sync', { force }); return data.data; }
export async function getSolvedProblems(page = 1, limit = 20) { const { data } = await api.get('/coding-profiles/leetcode/problems', { params: { page, limit } }); return data.data; }
export async function getProblemDays(from, to) { const { data } = await api.get('/coding-profiles/leetcode/days', { params: { from, to } }); return data.data; }
// Skill signals computed by the server from the stored problem log.
export async function getLeetCodeSkills() { const { data } = await api.get('/coding-profiles/leetcode/skills', { params: { today: localDayKey() } }); return data.data; }
