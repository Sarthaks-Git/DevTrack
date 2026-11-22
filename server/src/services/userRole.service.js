import User from '../models/User.js';
import AppError from '../utils/AppError.js';

const USERNAME = /^[a-z][a-z0-9_]{2,29}$/;
export const ROLES = ['user', 'admin'];

/**
 * Sets a user's role. Server-side only: there is no HTTP route for this. The owner runs it through
 * `npm run role:set`. The auth middleware reads the role from the database on every request, so the
 * change applies without signing out.
 */
export async function setUserRoleLogic({ username, role }) {
  const name = String(username || '').toLowerCase();
  if (!USERNAME.test(name)) throw new AppError('Invalid username', 400, 'VALIDATION_ERROR');
  if (!ROLES.includes(role)) throw new AppError(`Role must be one of ${ROLES.join(', ')}`, 400, 'VALIDATION_ERROR');

  const user = await User.findOneAndUpdate({ username: name }, { $set: { role } }, { returnDocument: 'after', projection: { username: 1, role: 1 } }).lean();
  if (!user) throw new AppError('User not found', 404);
  return { username: user.username, role: user.role };
}
