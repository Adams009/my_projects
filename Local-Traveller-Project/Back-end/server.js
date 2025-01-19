import dotenv from 'dotenv'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

//import routes
import mongoDbConnection from './config/database/DbConfig.js'
import Auth from './routes/UserAuth.js'

dotenv.config() //to use the .env file
const app = express() //create an instance of express
mongoDbConnection() // connect to MongoDB server


app.use(express.json()) //middleware
app.use(cookieParser()) //middleware
app.use(helmet()) //middleware


app.use('/api/', Auth)


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
}) // listen to the port 