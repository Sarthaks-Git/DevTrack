export function validateRegister(req, res, next) {
    const { username, email, password } = req.body ?? {};

    const errors = {};

    // Validate username
    if (typeof username !== 'string') {
        errors.username = 'Username must be a string';
    } else if (
        username.length < 3 ||
        username.length > 30
    ) {
        errors.username = 'Username must be 3–30 characters';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
        errors.username =
            'Username must start with a letter and contain only letters, numbers, or underscores';
    }

    // Validate email
    if (typeof email !== 'string') {
        errors.email = 'Email must be a string';
    } else if (
        email !== email.trim() ||
        /\s/.test(email)
    ) {
        errors.email = 'Email must not contain whitespace';
    } else if (
        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
    ) {
        errors.email = 'Please provide a valid email address';
    }

    // Validate password
    if (typeof password !== 'string') {
        errors.password = 'Password must be a string';
    } else if (
        password.length < 12 ||
        password.length > 128
    ) {
        errors.password = 'Password must be 12–128 characters';
    } else if (
        password !== password.trim()
    ) {
        errors.password =
            'Password must not start or end with whitespace';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        });
    }

    // Normalize email after successful validation
    req.body.email = email.toLowerCase();

    next();
}

export function validateLogin(req, res, next) {
    const { email, password } = req.body ?? {};

    const errors = {};

    if (typeof email !== 'string' ||
        email !== email.trim() ||
        /\s/.test(email) ||
        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        errors.email = 'Please provide a valid email address';
    }

    if (typeof password !== 'string' ||
        password.length < 1 ||
        password.length > 128) {
        errors.password = 'Invalid password';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        });
    }

    req.body.email = email.toLowerCase();

    next();
}