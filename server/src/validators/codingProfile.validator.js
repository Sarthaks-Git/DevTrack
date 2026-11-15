
import AppError from '../utils/AppError.js';

export function validateCodingProfile(req, res, next) {
    return next(
        new AppError(
            'Username-only linking is disabled. Use POST /verification/start to begin ownership verification.',
            410
        )
    );
}
