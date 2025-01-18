import dotenv from 'dotenv'
dotenv.config({ path: '../.env' });
import { V4 } from 'paseto'
import crypto from 'crypto'

dotenv.config()

//eda require here
const private_key = crypto.createPrivateKey(process.env.PRIVATE_KEY_NOW)
const public_key = crypto.createPublicKey(process.env.PUBLIC_KEY_NOW)


const signToken = async (payload) => {
    return await V4.sign(payload, private_key) 
}

const verifyToken = async (payload) => {
    try {
        return await V4.verify(payload, public_key)
    } catch (e) {
        throw new Error('Invalid or Expired token')
    }
}

export { signToken, verifyToken }