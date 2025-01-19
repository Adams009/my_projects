import rateLimit from 'express-rate-limit'

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max : 5,
    message : "Too many attempts, Try again after 15 minutes",
})

const refreshTokenLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message : "Too many attempts, Try again after 5 minutes",
})

export {loginLimiter, refreshTokenLimiter}