
import AppError from '../utils/AppError.js';

const ALLOWED_STATUSES = [
    'planning',
    'in_progress',
    'completed',
    'archived',
];

const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

const ALLOWED_FIELDS = [
    'title',
    'description',
    'status',
    'priority',
    'technologies',
    'githubUrl',
    'liveUrl',
    'startDate',
    'endDate',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
        return false;
    }

    const [year, month, day] = value.split('-').map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function isValidUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }

    try {
        const url = new URL(value);

        return (
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            Boolean(url.hostname) &&
            !url.username &&
            !url.password
        );
    } catch {
        return false;
    }
}

function validateProjectData(data, { partial = false } = {}) {
    if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data)
    ) {
        throw new AppError('Request body must be an object', 400);
    }

    const fields = Object.keys(data);

    const unexpectedFields = fields.filter(
        (field) => !ALLOWED_FIELDS.includes(field)
    );

    if (unexpectedFields.length > 0) {
        throw new AppError(
            `Unexpected field(s): ${unexpectedFields.join(', ')}`,
            400
        );
    }

    if (partial && fields.length === 0) {
        throw new AppError(
            'At least one field must be provided for update',
            400
        );
    }

    if (!partial && !fields.includes('title')) {
        throw new AppError('Project title is required', 400);
    }

    if (fields.includes('title')) {
        const { title } = data;

        if (typeof title !== 'string') {
            throw new AppError('Project title must be a string', 400);
        }

        const trimmedTitle = title.trim();

        if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
            throw new AppError(
                'Project title must be between 3 and 120 characters',
                400
            );
        }
    }

    if (fields.includes('description')) {
        const { description } = data;

        if (typeof description !== 'string') {
            throw new AppError(
                'Project description must be a string',
                400
            );
        }

        if (description.trim().length > 2000) {
            throw new AppError(
                'Project description cannot exceed 2000 characters',
                400
            );
        }
    }

    if (fields.includes('status')) {
        if (!ALLOWED_STATUSES.includes(data.status)) {
            throw new AppError('Invalid project status', 400);
        }
    }

    if (fields.includes('priority')) {
        if (!ALLOWED_PRIORITIES.includes(data.priority)) {
            throw new AppError('Invalid project priority', 400);
        }
    }

    if (fields.includes('technologies')) {
        const { technologies } = data;

        if (!Array.isArray(technologies)) {
            throw new AppError(
                'Technologies must be an array',
                400
            );
        }

        if (technologies.length > 30) {
            throw new AppError(
                'A project cannot have more than 30 technologies',
                400
            );
        }

        for (const technology of technologies) {
            if (
                typeof technology !== 'string' ||
                technology.trim().length === 0 ||
                technology.trim().length > 50
            ) {
                throw new AppError(
                    'Each technology must be a non-empty string of at most 50 characters',
                    400
                );
            }
        }
    }

    for (const field of ['githubUrl', 'liveUrl']) {
        if (fields.includes(field)) {
            const value = data[field];

            if (value === '') {
                continue;
            }

            if (!isValidUrl(value)) {
                throw new AppError(
                    `${field} must be a valid HTTP or HTTPS URL`,
                    400
                );
            }
        }
    }

    for (const field of ['startDate', 'endDate']) {
        if (fields.includes(field)) {
            const value = data[field];

            if (value === null) {
                continue;
            }

            if (!isValidDateOnly(value)) {
                throw new AppError(
                    `${field} must be a valid date in YYYY-MM-DD format or null`,
                    400
                );
            }
        }
    }

    const startDate = fields.includes('startDate')
        ? data.startDate
        : undefined;

    const endDate = fields.includes('endDate')
        ? data.endDate
        : undefined;

    if (
        startDate &&
        endDate &&
        new Date(`${endDate}T00:00:00.000Z`) <
            new Date(`${startDate}T00:00:00.000Z`)
    ) {
        throw new AppError(
            'End date cannot be earlier than start date',
            400
        );
    }
}

export function validateCreateProject(req, res, next) {
    try {
        validateProjectData(req.body);
        next();
    } catch (error) {
        next(error);
    }
}

export function validateUpdateProject(req, res, next) {
    try {
        validateProjectData(req.body, { partial: true });
        next();
    } catch (error) {
        next(error);
    }
}
