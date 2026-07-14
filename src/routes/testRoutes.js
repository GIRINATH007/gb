import express from 'express'

import {
 testNotification
}
from '../controllers/testNotificationController.js'

const router = express.Router()

router.post(
 '/test-notification',
 testNotification
)

export default router