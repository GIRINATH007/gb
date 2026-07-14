import express from 'express'
import * as friendController from '../controllers/friendController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/request', requireAuth, friendController.sendRequest)
router.get('/pending', requireAuth, friendController.getPending)
router.post('/accept', requireAuth, friendController.acceptRequest)
router.post('/reject', requireAuth, friendController.rejectRequest)
router.get('/search', requireAuth, friendController.searchUsers)
router.get('/', requireAuth, friendController.getFriends)
router.get('/:friendId/passport', requireAuth, friendController.getFriendPassport)
router.delete('/:friendId', requireAuth, friendController.removeFriend)
router.get('/:friendId', requireAuth, friendController.getFriendProfile)

export default router
