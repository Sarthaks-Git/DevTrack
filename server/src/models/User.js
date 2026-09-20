   import mongoose from 'mongoose'

    // Define the schema

    const userSchema = new mongoose.Schema({
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            lowercase: true,
            required: true,
            unique: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
    }, { timestamps: true });

    const User = mongoose.model('User', userSchema);
    export default User