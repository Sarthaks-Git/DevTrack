require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db.js');
const bcrypt = require('bcrypt');
const User = require('./models/User.js');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send("Hello Client!!!");
});

app.get('/api/health', (req, res) => {
    res.send("DevTrack API is healthy:)");
});

app.post('/api/test', (req, res) => {
    const { username, email } = req.body;
    res.status(201).json({ message: "User Created Successfully!", user: { username, email } });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        //validation of required fields
        if(!username || !email || !password) {
            return res.status(400).json({message:"All fields are required"});
        }

        //basic password length validation
        if(password.length < 8){
            return res.status(400).json({message:"Password must be 8 characters"});
        }

        //check for existing user

        const existingUser=await User.findOne({
            $or:[{username},{email:email.toLowerCase()}]
        });
        if(existingUser){
            return res.status(409).json({message:"Username or email already exists"});
        }

        //password hashing
        const passwordHash=await bcrypt.hash(password,12);

        //create user 
        const user=await User.create({
            username,email:email.toLowerCase(),
            passwordHash
        });

        //safe response
        return res.status(201).json({messsage:"Registration successful",
            user:{
                id:user._id,
                username:user.username,
                email:user.email,
            }
        });

    } catch (error) {
        console.error("Registration error:",error.message);

        return res.status(500).json({message:"Internal server error"
        });
    }
});

app.post('/api/auth/login',async (req,res)=>{
    try{
        const {email,password}=req.body;
        // validating for input fields
        if(!email || !password){
            res.status(400).json({message:"All fields are required"});
        }

        //basic password length validation
        
        if(password.length < 8){
            return res.status(400).json({message:"Password must be 8 characters"});
        }

        const user=await User.findOne({
            $or:[{username},{email:email.toLowerCase()}]
        });
        if(!existingUser){
            return res.status(401).json({message:"Invalid credentials"});
        }
        const isPasswordCorrect= await bcrypt.compare(password,user.passwordHash);

        if(!isPasswordCorrect){
            return res.status(401).json({message:'Invalid Credentials'});
        }

        res.status(200).json({message:"Login Successful",
            user:{id:user._id,
                name:user.username,
                email:user.email,
            }
        });

    }catch(error){
        console.error("Login Error:",error);
        res.status(500).json({message:"Internal Server Error"});
    }
})

// 1. Connect to Database First
connectDB().then(() => {
    // 2. Start Server only after DB connects successfully
    app.listen(port, () => {
        console.log(`Server Started at Port ${port}!!`);
    });
}).catch((err) => {
    console.error("Failed to start server due to DB connection error:", err.message);
});
