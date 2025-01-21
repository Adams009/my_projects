import dotenv from 'dotenv'
dotenv.config({ path: '../.env' });
import { V4 } from 'paseto'
import crypto from 'crypto'

dotenv.config()

import Blacklist from '../models/TokenBlackList.js';

//Ed25519 key require here
const private_key = crypto.createPrivateKey(process.env.PRIVATE_KEY_NOW)
const public_key = crypto.createPublicKey(process.env.PUBLIC_KEY_NOW)


const signToken = async (payload, expiresIn = '15m') => {
    try {
        if (!payload) {
            throw new Error('Payload is required')
        }

        const timeUnit = expiresIn.slice(-1); // 'm' or 'd' or 's' or 'h'
        const timeValue = parseInt(expiresIn.slice(0, -1), 10); // Numeric part (e.g., 15, 7)

        if (isNaN(timeValue) || timeValue <= 0) {
            throw new Error('Invalid numeric value in expiresIn. Please provide a valid positive number.');
        }

        if (timeUnit !== 'm' && timeUnit !== 'd' && timeUnit !== 's' && timeUnit !== 'h') {
            throw new Error('Invalid time unit in expiresIn. Please use "m" for minutes or "d" for days or "s" for seconds or "h" for hours');
        }

        // calculate the time when the token will expire
        let expiresForTime;

        if (timeUnit === 'm') {
            expiresForTime = `${timeValue} minutes`;
            // expiresForTime = new Date(Date.now() + timeValue * 60 * 1000).toISOString(); // Minutes to ISO 8601 String format
        } else if (timeUnit === 'd') {
            // const expiresForDay = new Date(Date.now() + parseInt(expiresIn) * 86400000)
            expiresForTime = `${timeValue} days`
        } else if (timeUnit === 'h') {
            expiresForTime = `${timeValue} hours`
        } else if (timeUnit === 's') {
            expiresForTime = `${timeValue} seconds`
        }
    
        // Set the expiration time in the payload

        // Ensure private_key is defined before signing

        // Sign and return the token
        return await V4.sign(payload, private_key, { expiresIn : expiresForTime}) 
    } catch (e) {
        console.error(`Error signing token: ${e.message}`); // Log the detailed error
        throw new Error('An Error Occur'); // User-friendly error message
    }
}

const verifyToken = async (token) => {
    try {
        if (!token) {
            throw new Error('Token is required');
        }

        // Hash the token
        const hashedTokenToCheck = crypto.createHash('sha256').update(token).digest('hex');

        // Check if the token is blacklisted
        const isBlacklisted = await Blacklist.findOne({ token : hashedTokenToCheck });
        if (isBlacklisted) {
            throw new Error('Token is blacklisted');
        }

        // ensure public_key is defined before verifying

        // Verify the token
        const decoded = await V4.verify(token, public_key)
        
        // Additional timestamp check (if necessary)
        const currentTimestamp = new Date(Date.now()).toISOString();
        
        if (decoded.exp < currentTimestamp) {
            throw new Error('Token has expired');
        }

        return decoded;

    } catch (e) {
        console.error(`Error verifying token: ${e.message}`); // Log the detailed error
        throw new Error('Invalid or Expired token'); // User-friendly error message
    }
}

export { signToken, verifyToken }