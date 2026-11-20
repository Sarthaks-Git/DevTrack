import { getPushStatusLogic, removeDeviceLogic, sendTestLogic, subscribeLogic, unsubscribeEndpointLogic } from '../services/push.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export async function getPushStatus(req, res, next) {
  try {
    return ok(res, await getPushStatusLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function subscribePush(req, res, next) {
  try {
    return ok(res, await subscribeLogic(req.auth.userId, req.validatedSubscription, req.get('user-agent')), 201);
  } catch (error) {
    return next(error);
  }
}

export async function unsubscribePush(req, res, next) {
  try {
    return ok(res, await unsubscribeEndpointLogic(req.auth.userId, req.validatedEndpoint));
  } catch (error) {
    return next(error);
  }
}

export async function removePushDevice(req, res, next) {
  try {
    return ok(res, await removeDeviceLogic(req.auth.userId, req.params.id));
  } catch (error) {
    return next(error);
  }
}

export async function sendTestPush(req, res, next) {
  try {
    return ok(res, await sendTestLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}
