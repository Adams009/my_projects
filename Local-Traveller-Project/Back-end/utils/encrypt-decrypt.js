import crypto from 'crypto';
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' });

//rsa key required here
const publicKey = process.env.PUBLIC_KEY2;
const privateKey = process.env.PRIVATE_KEY1

const encryptToken = (token) => {

    const buffer = Buffer.from(token, 'utf8');
    const encrypted = crypto.publicEncrypt(publicKey, buffer);
    return encrypted.toString('base64');
}

const decryptToken = (token) => {
    const buffer = Buffer.from(token, 'base64');
    const decrypted = crypto.privateDecrypt(privateKey, buffer);
    return decrypted.toString('utf8');
}

export { encryptToken, decryptToken }


