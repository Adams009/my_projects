import User from '#models/userModel.js';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import config from '#config/envConfig.js';

class AuthService {
    async register({ firstName, lastName, email, password }) {
        let existingAccountNumber = true;
        let accountNumber;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('User already exists.');
        }

        const passwordHash = await argon2.hash(password);

        while (existingAccountNumber) {
            accountNumber = this.generateAccountNumber();
            const existingAccount = await User.findOne({ accountNumber });
            if (!existingAccount) {
                existingAccountNumber = false;
            }
        }
        const newUser = new User({ firstName, lastName, email, password : passwordHash, accountNumber });
        await newUser.save();
        return {
            status: 'success',
            message: 'User registered successfully.',
            data: {
                id: newUser._id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                accountNumber: newUser.accountNumber
            }
        };
    }

    generateToken = (payload, secret, duration) => {
    return jwt.sign(payload, secret, { expiresIn: duration });
    }

    async login({ email, password }) {
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('Invalid email or password.');
        }

        const isPasswordValid = await argon2.verify(user.password, password)
        if (!isPasswordValid) {
            throw new Error('Invalid email or password.');
        }
        
        const payload = { 
            id: user._id, 
            accountNumber: user.accountNumber,
            email: user.email
        }

        const accessToken = this.generateToken(payload, config.jwtSecret, '15m');
        const refreshToken = this.generateToken(payload, config.refreshSecret, '7d');

        return {
            status: 'success',
            message: 'Login successful.',
            data: {
                accessToken,
                refreshToken,
                id: user._id
            }
        };
    }

    generateAccountNumber() {
        // Implement account number generation logic here
        return Math.floor(1000000000 + Math.random() * 9000000000).toString();
    }

    async refreshToken(refreshToken) {
        if (!refreshToken) {
            throw new Error('No refresh token');
        }

        const decoded = jwt.verify(refreshToken, config.refreshSecret);
        const user = await User.findById(decoded.id).select("-password");
        if (!user) {
            throw new Error("User not found");
        }

        const payload = { 
            id: user._id, 
            accountNumber: user.accountNumber,
            email: user.email
        }

        const newAccessToken = this.generateToken(payload, config.jwtSecret, '15m');
        const newRefreshToken = this.generateToken(payload, config.refreshSecret, '7d');
        return {
            data: {
                newAccessToken,
                newRefreshToken,
                id: user._id
            }
        }
    }
}

export default AuthService;