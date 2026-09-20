import User from '../models/User.js';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt.js';
import AppError from '../utils/AppError.js';

export async function registerLogic(username, email, password) {
    if (!username || !email || !password) {
        throw new AppError('All fields are required', 400);
    }

    //basic password length validation
    if (password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400);
    }

    //check for existing user

    const existingUser = await User.findOne({
        $or: [{ username }, { email: email.toLowerCase() }]
    });
    if (existingUser) {
        throw new AppError("Username or email already exists", 409);
    }

    //password hashing
    const passwordHash = await bcrypt.hash(password, 12);

    //create user 
    const user = await User.create({
        username, email: email.toLowerCase(),
        passwordHash
    });

    const token = generateToken(user._id);

    return {
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }, token
    };
}

export async function loginLogic(email, password) {
    if (!email || !password) {
        throw new AppError("All fields are required", 400);
    }

    const user = await User.findOne({
        email: email.toLowerCase()
    }).select('+passwordHash');
    if (!user) {

        throw new AppError('Invalid Credentials', 401);
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordCorrect) {

        throw new AppError('Invalid Credentials', 401);
    }

    const token = generateToken(user._id);

    return {
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        }, token
    }
}

export async function getMeLogic(userId) {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError("User does not exist", 404);
    }

    return {
        id: user._id,
        username: user.username,
        email: user.email
    };
}