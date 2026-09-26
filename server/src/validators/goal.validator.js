const allowedStatuses = [
    'not_started',
    'in_progress',
    'completed',
    'archived'
];

const allowedPriorities = [
    'low',
    'medium',
    'high'
];

function isValidDateOnly(value) {
    if (typeof value !== 'string') {
        return false;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

export function validateCreateGoal(req, res, next) {
    const {
        title,
        description,
        status,
        priority,
        deadline
    } = req.body ?? {};

    const errors = {};

    // Title validation
    if (typeof title !== 'string') {
        errors.title = 'Title is required';
    } else if (title.trim().length < 3 || title.trim().length > 120) {
        errors.title = 'Title must be 3–120 characters';
    }

    // Description validation
    if (
        description !== undefined &&
        typeof description !== 'string'
    ) {
        errors.description = 'Description must be a string';
    } else if (
        typeof description === 'string' &&
        description.length > 2000
    ) {
        errors.description = 'Description cannot exceed 2000 characters';
    }

    // Status validation
    if (
        status !== undefined &&
        !allowedStatuses.includes(status)
    ) {
        errors.status = 'Invalid status';
    }

    // Priority validation
    if (
        priority !== undefined &&
        !allowedPriorities.includes(priority)
    ) {
        errors.priority = 'Invalid priority';
    }

    // Deadline validation
    if (deadline !== undefined && deadline !== null) {
    if (!isValidDateOnly(deadline)) {
        errors.deadline =
            'Deadline must be a valid date in YYYY-MM-DD format';
    }
}

    // Reject ownership information from the request
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'owner')) {
        errors.owner = 'Owner cannot be provided by the client';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        });
    }

    req.body.title = title.trim();

    next();
}

export function validateUpdateGoal(req, res, next) {
    const {
        title,
        description,
        status,
        priority,
        deadline
    } = req.body ?? {};

    const errors = {};
    const allowedFields = [
        'title',
        'description',
        'status',
        'priority',
        'deadline'
    ];

    const receivedFields = Object.keys(req.body ?? {});

    // Reject unknown fields
    const unknownFields = receivedFields.filter(
        field => !allowedFields.includes(field)
    );

    if (unknownFields.length > 0) {
        errors.fields = 'Request contains invalid fields';
    }

    // At least one field must be provided
    if (receivedFields.length === 0) {
        errors.body = 'At least one field is required';
    }

    // Title validation
    if (title !== undefined) {
        if (
            typeof title !== 'string' ||
            title.trim().length < 3 ||
            title.trim().length > 120
        ) {
            errors.title = 'Title must be 3–120 characters';
        }
    }

    // Description validation
    if (
        description !== undefined &&
        (typeof description !== 'string' ||
            description.length > 2000)
    ) {
        errors.description = 'Invalid description';
    }

    // Status validation
    if (
        status !== undefined &&
        ![
            'not_started',
            'in_progress',
            'completed',
            'archived'
        ].includes(status)
    ) {
        errors.status = 'Invalid status';
    }

    // Priority validation
    if (
        priority !== undefined &&
        !['low', 'medium', 'high'].includes(priority)
    ) {
        errors.priority = 'Invalid priority';
    }

    // Deadline validation
    if (deadline !== undefined && deadline !== null) {
    if (!isValidDateOnly(deadline)) {
        errors.deadline =
            'Deadline must be a valid date in YYYY-MM-DD format';
    }
}

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        });
    }

    if (typeof title === 'string') {
        req.body.title = title.trim();
    }

    next();
}