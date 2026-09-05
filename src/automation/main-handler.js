import {startDirectShort, makeRunIdempotencyKey} from '../pipeline/direct-run.service.js';
import {schedules} from '../database/repositories/schedule.repository.js';
import {projects} from '../database/repositories/project.repository.js';

const clean = value => String(value ?? '').trim();
const DEFAULT_PROMPT = 'Create a unique 60-second YouTube Short';

function error(code, message, status = 400) {
  return Object.assign(new Error(message), {code, status});
}

function parseSchedule(value) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) throw error('INVALID_SCHEDULE_TIME', 'schedule_at must be a valid ISO date/time', 400);
  return date;
}

export async function dispatchWork({userId, projectId, prompt, scheduleAt, idempotencyKey, source = 'automation-handler'}) {
  if (!userId) throw error('AUTH_REQUIRED', 'Authentication is required', 401);
  if (!projectId) throw error('PROJECT_NOT_FOUND', 'project_id is required', 400);

  const project = await projects.get(projectId, userId);
  if (!project) throw error('PROJECT_NOT_FOUND', 'Project not found', 404);
  if (!project.channel_id) throw error('CHANNEL_NOT_CONNECTED', 'Project has no connected YouTube channel', 409);

  const normalizedPrompt = clean(prompt) || DEFAULT_PROMPT;
  const scheduled = parseSchedule(scheduleAt);
  const key = makeRunIdempotencyKey({projectId, prompt: normalizedPrompt, idempotencyKey});

  if (!scheduled || scheduled.getTime() <= Date.now() + 5000) {
    return {mode: 'started', ...(await startDirectShort({userId, projectId, prompt: normalizedPrompt, idempotencyKey: key, source}))};
  }

  const schedule = await schedules.create({
    userId,
    channelId: project.channel_id,
    projectId,
    publishAt: scheduled.toISOString(),
    timezone: 'UTC',
    scheduleType: 'once',
    payload: {prompt: normalizedPrompt, idempotency_key: key, source: 'scheduled-automation'},
    enabled: true,
    name: `Short ${scheduled.toISOString()}`
  });

  return {mode: 'scheduled', schedule, project_id: projectId, schedule_at: scheduled.toISOString()};
}

export function automationReadiness() {
  return {
    service: 'automation-api',
    runtime: 'ready',
    pipeline: 'ready',
    contract: 'v2',
    timestamp: new Date().toISOString()
  };
}
