import express from 'express'
import config from './config/envConfig.js'
import mongoConnect from './config/mongoDbConfig.js';
import cookieParser from 'cookie-parser'
import cors from 'cors'
import compression from 'express-compression'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import yaml from 'yaml'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path  from 'path'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Load and serve OpenAPI/Swagger documentation
const swaggerFile = fs.readFileSync(path.join(__dirname, 'openapi.yml'), 'utf8')
const swaggerSpec = yaml.parse(swaggerFile)

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
// Serve OpenAPI spec as JSON
app.get('/api-spec.json', (req, res) => {
  res.json(swaggerSpec)
})

// Serve OpenAPI spec as YAML
app.get('/api-spec.yml', (req, res) => {
  res.type('application/yaml')
  res.send(swaggerFile)
})



import authRoutes from '#routes/authRoute.js';
import accountRoutes from '#routes/accountRoute.js';

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);

app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to the Bank App API',
      documentation: `http://localhost:${PORT}/api-docs`,
      specJson: `http://localhost:${PORT}/api-spec.json`,
      specYaml: `http://localhost:${PORT}/api-spec.yml`
    })
})


const PORT = config.port

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})