import { loginLogic, registerLogic, getMeLogic } from '../services/auth.service.js';
import { setAuthCookies } from '../utils/cookies.js';

export async function register(req, res, next) {
    try {
        const { username, email, password } = req.body;

        const result = await registerLogic(username, email, password);
        setAuthCookies(res, result.token);
        //safe response
        return res.status(201).json({
            message: "Registration successful",
            user: result.user,
        });

    } catch (error) {
        next(error);
    }
}

export async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        // validating for input fields

        const result = await loginLogic(email, password);

        setAuthCookies(res, result.token);
        return res.status(200).json({
            message: "Login Successful",
            user: result.user,
        });

    } catch (error) {
        next(error);
    }
}

export async function getMe(req, res, next) {
    try {

        const result = await getMeLogic(req.user.id);
        return res.status(200).json({
            user: result
        });

    } catch (error) {
        next(error);
    }
}

export function logout(req, res) {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });

    return res.status(200).json({
        message: 'Logout successful'
    });
}