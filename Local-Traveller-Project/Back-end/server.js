import dotenv from 'dotenv'

import express from 'express'
import mongoDbConnection from './config/database/DbConfig.js'

import Register from './routes/UserAuth.js'

dotenv.config() //to use the .env file
const app = express() //create an instance of express
mongoDbConnection() // connect to MongoDB server

app.use(express.json()) //middleware

app.use('/api/register', Register)


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
}) // listen to the port 