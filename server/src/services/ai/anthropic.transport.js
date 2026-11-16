import Anthropic from '@anthropic-ai/sdk';
import config from '../../config/config.js';

// The only module that talks to the AI provider. Tests mock it, so no test sends a request.
let client = null;

function getClient() {
  if (!client) client = new Anthropic({ apiKey: config.AI.apiKey, maxRetries: 2, timeout: 30_000 });
  return client;
}

export class AiTransportError extends Error {
  constructor(kind) {
    super(`AI provider request failed: ${kind}`);
    this.name = 'AiTransportError';
    this.kind = kind;
  }
}

// Maps SDK errors to a kind word. Never includes the request, the response body or the key.
function kindFor(error) {
  const status = error?.status;
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'misconfigured';
  if (status === 400 || status === 404 || status === 413) return 'rejected';
  return 'unavailable';
}

export async function createMessage(params) {
  try {
    return await getClient().messages.create(params);
  } catch (error) {
    throw new AiTransportError(kindFor(error));
  }
}
