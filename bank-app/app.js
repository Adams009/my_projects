import express from 'express'
import config from './config/envConfig.js'
import mongoConnect from './config/mongoDbConfig.js';
import cookieParser from 'cookie-parser'
import cors from 'cors'
import compression from 'express-compression'
import helmet from 'helmet'

const app = express()
mongoConnect();

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  compression({
    brotli: { enabled: true, zlib: {} },
    threshold: 1024, // compress only if response > 1KB
  })
);
app.use(helmet())

import authRoutes from '#routes/authRoute.js';
import accountRoutes from '#routes/accountRoute.js';

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);

app.get('/', (req, res) => {
    res.send('Welcome to the Bank App API')
})


const PORT = config.port

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})