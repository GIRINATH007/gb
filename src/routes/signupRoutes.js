import express from 'express'
import {
  signupInitController,
  signupCompleteController
} from '../controllers/signupController.js'

const router = express.Router()

router.post('/signup-init', signupInitController)
router.post('/signup-complete', signupCompleteController)

export default router
