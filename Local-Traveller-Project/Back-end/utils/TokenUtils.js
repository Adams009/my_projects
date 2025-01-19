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
    if (!payload) {
        throw new Error('Payload is required')
    }

    const timeUnit = expiresIn.slice(-1); // 'm' or 'd'
    const timeValue = parseInt(expiresIn.slice(0, -1), 10); // Numeric part (e.g., 15, 7)

    if (isNaN(timeValue) || timeValue <= 0) {
        throw new Error('Invalid numeric value in expiresIn. Please provide a valid positive number.');
    }

    if (timeUnit !== 'm' && timeUnit !== 'd') {
        throw new Error('Invalid time unit in expiresIn. Please use "m" for minutes or "d" for days');
    }

    // calculate the time when the token will expire
    let expiresForTime;

    if (timeUnit === 'm') {
        expiresForTime = Math.floor(Date.now() / 1000) + timeValue * 60; // Minutes to seconds
    } else if (timeUnit === 'd') {
        // const expiresForDay = new Date(Date.now() + parseInt(expiresIn) * 86400000)
        expiresForTime = Math.floor(Date.now() / 1000) + timeValue * 24 * 60 * 60; // Days to seconds
    }

    // Set the expiration time in the payload
    payload.exp = expiresForTime;

    // Ensure private_key is defined before signing

    // Sign and return the token
    return await V4.sign(payload, private_key) 
}

const verifyToken = async (token) => {
    try {
        if (token) {
            throw new Error('Token is required');
        }

        const isBlacklisted = await Blacklist.findOne({ token });
        if (isBlacklisted) {
            throw new Error('Token is blacklisted');
        }

        // ensure public_key is defined before verifying

        return await V4.verify(token, public_key)
    } catch (e) {
        throw new Error('Invalid or Expired token', e.message)
    }
}

export { signToken, verifyToken }