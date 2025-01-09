import express from 'express'
import dotenv from 'dotenv'

dotenv.config() //to use the .env file
const app = express() //create an instance of express

app.use(express.json()) //middleware


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
}) // listen to the port 