import jwt from 'jsonwebtoken'
import config from '../config/config.js'
import AppError from '../utils/AppError.js'

export function authMiddleware(req, res, next) {

    const token = req.cookies.accessToken;
    if (!token) {
        throw new AppError("Unauthorized", 401);
    }
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError('Authorization Error', 401);
    }

}