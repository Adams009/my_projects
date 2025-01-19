import argon2 from 'argon2'
import { signToken, verifyToken } from '../utils/TokenUtils.js';

import User from '../models/User.js';
import Blacklist from '../models/TokenBlackList.js';

const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body; // get email and password from request body

        // check if user exists
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // check if password is correct
        const validPassword = await argon2.verify(user.password, password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // generate token
        const userInformation = {
            id: user._id,
            email: user.email,
            role: user.role,
        };
        const accesstoken = await signToken(userInformation, '15m');
        const refreshToken = await signToken(userInformation, '7d');

        // create cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            // secure: true, // will be set to true when deploying to production
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });

        // send token as response
        res.json({ 
            message : 'Login Successful',
            accesstoken });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
}


const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        // verify token
        const decoded = await verifyToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // generate new access token
        const userInformation = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
        };
        const newAccesstoken = await signToken(userInformation, '15m');
        const newRefreshToken = await signToken(userInformation, '7d');

        // create cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });
          
        // send token as response
        res.json({ accesstoken : newAccesstoken });
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: 'Invalid or expired refresh token.' });
    }
}

const logoutUser = async (req, res) => {
    try {
        // Get the refresh token from the cookies
    
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        // verify token
        const decoded = await verifyToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Add token to the blacklist
        await Blacklist.create({ token: refreshToken });

        // Clear the refresh token from the session and browser session
        res.clearCookie('refreshToken', { path: '/' });
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
}

export { refreshToken, loginUser, logoutUser }