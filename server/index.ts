import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: 'V2', ts: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 SSG Server running at http://localhost:${PORT}`)
})