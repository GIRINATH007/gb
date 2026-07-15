import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'

import authRoutes from './routes/authRoutes.js'
import profileRoutes from './routes/profileRoutes.js'
import statsRoutes from './routes/statsRoutes.js'
import passportRoutes from './routes/passportRoutes.js'
import roomRoutes from './routes/roomRoutes.js'
//import leaderboardRoutes from './routes/leaderboardRoutes.js'
import testRoutes from './routes/testRoutes.js'
import otpRoutes from './routes/otpRoutes.js'
import signupRoutes from './routes/signupRoutes.js'
import friendRoutes from './routes/friendRoutes.js'
import trackingRoutes from './routes/trackingRoutes.js'
import territoryRoutes from './routes/territoryRoutes.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    message: 'GeoLoop backend running',
  })
})


app.use('/auth', authRoutes)
app.use('/auth', signupRoutes)
app.use('/profile', profileRoutes)
app.use('/stats', statsRoutes)
app.use('/passport', passportRoutes)
app.use('/rooms', roomRoutes)
app.use('/friends', friendRoutes)
app.use('/tracking', trackingRoutes)
app.use('/territories', territoryRoutes)
//app.use('/leaderboard', leaderboardRoutes)
app.use('/api', testRoutes)
app.use('/otp', otpRoutes)

const PORT = process.env.PORT || 5000

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ErrorHandler]', err?.message || err)
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'
  const code = err.code || 'INTERNAL_ERROR'

  return res.status(statusCode).json({
    success: false,
    message,
    code,
  })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})