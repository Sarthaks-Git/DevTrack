import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';

export function validateObjectId(paramName) {
    return function (req, res, next) {
        const id = req.params[paramName];

        if (!mongoose.isObjectIdOrHexString(id)) {
            return next(new AppError('Invalid resource ID', 400));
        }

        next();
    };
}