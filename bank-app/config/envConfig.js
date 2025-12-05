import dotenv from 'dotenv'
dotenv.config()

const config = {
    port : Number(process.env.PORT),
    mongoDbUrl : String(process.env.MONGODBURI),
    jwtSecret : String(process.env.JWT_SECRET),
    refreshSecret : String(process.env.REFRESH_SECRET)
}

export default config