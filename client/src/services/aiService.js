import api from './api';

export async function getAiStatus() { const { data } = await api.get('/ai'); return data.data; }
export async function setAiConsent(enabled) { const { data } = await api.put('/ai/consent', { enabled }); return data.data; }

export async function listSecurityReviews(params = {}) { const { data } = await api.get('/security-reviews', { params }); return data.data.reviews; }
export async function setSecurityReviewStatus(id, status) { const { data } = await api.patch(`/security-reviews/${id}`, { status }); return data.data.review; }
export async function updateSecurityItem(id, itemKey, state) { const { data } = await api.patch(`/security-reviews/${id}/items/${itemKey}`, { state }); return data.data.review; }

export async function setCodeReview(projectId, enabled) { const { data } = await api.put(`/projects/${projectId}/repository/code-review`, { enabled }); return data.data.codeReview; }
export async function listCodeFindings(params = {}) { const { data } = await api.get('/code-findings', { params }); return data.data.findings; }
export async function setCodeFindingStatus(id, status) { const { data } = await api.patch(`/code-findings/${id}`, { status }); return data.data.finding; }
