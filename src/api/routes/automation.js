import {dispatchWork, automationReadiness} from '../../automation/main-handler.js';
import {getDirectRun} from '../../pipeline/direct-run.service.js';

const send = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(data));
};

export function readiness(req, res) {
  return send(res, 200, {success: true, data: automationReadiness()});
}

export async function dispatch(req, res) {
  try {
    const body = req.body || {};
    const result = await dispatchWork({
      userId: req.user.id,
      projectId: body.project_id,
      prompt: body.prompt,
      scheduleAt: body.schedule_at,
      idempotencyKey: body.idempotency_key,
      source: 'automation-handler'
    });
    return send(res, result.mode === 'scheduled' ? 201 : 202, {success: true, ...result});
  } catch (error) {
    console.error('automation.dispatch failed', {code: error.code || 'RUN_FAILED', message: error.message});
    return send(res, error.status || 500, {
      success: false,
      error: {code: error.code || 'RUN_FAILED', message: error.status ? error.message : 'Automation work could not be started'}
    });
  }
}

export async function status(req, res) {
  try {
    const run = await getDirectRun({userId: req.user.id, runId: req.params.runId, projectId: req.params.projectId});
    return send(res, 200, {success: true, data: {
      id: run.id,
      project_id: run.project_id,
      status: run.status,
      current_step: run.current_step,
      progress: run.progress,
      steps: run.steps,
      state: run.state,
      created_at: run.created_at,
      updated_at: run.updated_at,
      completed_at: run.completed_at
    }});
  } catch (error) {
    return send(res, error.status || 500, {success: false, error: {code: error.code || 'RUN_STATUS_FAILED', message: error.status ? error.message : 'Run status unavailable'}});
  }
}
