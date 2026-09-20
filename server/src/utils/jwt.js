import jwt from 'jsonwebtoken'
import config from '../config/config.js'

export function generateToken(userId){
    const token = jwt.sign({
            id: userId,
        }, config.JWT_SECRET, {
            expiresIn: "1d"
        });

    return token;
}
