import * as roomService from '../services/roomService.js'

function handleError(res, error) {
  const statusCode = error.statusCode || 500
  const message = error.message || 'Room operation failed'
  const code = error.code || 'OPERATION_FAILED'

  return res.status(statusCode).json({
    success: false,
    message,
    code,
  })
}
//POST /rooms/create
export async function createRoom(req, res) {
  try {
    const userId = req.user.id
    const { roomName } = req.body

    if (!roomName || typeof roomName !== 'string' || roomName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Room name is required',
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await roomService.createRoom(userId, roomName.trim())

    return res.status(201).json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleError(res, error)
  }
}

//POST /rooms/join
export async function joinRoom(req, res) {
  try {
    const userId = req.user.id
    const { code } = req.body

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room code. Must be 6 digits.',
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await roomService.joinRoomByCode(userId, code)

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleError(res, error)
  }
}
//GET /rooms/my-rooms
export async function getUserRooms(req, res) {
  try {
    const userId = req.user.id

    const rooms = await roomService.getUserRooms(userId)

    return res.status(200).json({
      success: true,
      rooms,
      count: rooms.length,
    })
  } catch (error) {
    return handleError(res, error)
  }
}

//GET /rooms/:roomId/leaderboard

export async function getRoomLeaderboard(req, res) {
  try {
    const { roomId } = req.params

    const leaderboard = await roomService.getRoomLeaderboard(roomId)

    return res.status(200).json({
      success: true,
      leaderboard,
      count: leaderboard.length,
    })
  } catch (error) {
    return handleError(res, error)
  }
}

//POST /rooms/:roomId/score
export async function updateScore(req, res) {
  try {
    const userId = req.user.id
    const { roomId } = req.params
    const { scoreIncrement } = req.body

    if (
      typeof scoreIncrement !== 'number' ||
      scoreIncrement === 0 ||
      !Number.isInteger(scoreIncrement)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Score increment must be a non-zero integer',
        code: 'VALIDATION_ERROR',
      })
    }

    const updated = await roomService.updateRoomScore(userId, roomId, scoreIncrement)

    return res.status(200).json({
      success: true,
      score: updated.score,
    })
  } catch (error) {
    return handleError(res, error)
  }
}

//POST /rooms/:roomId/leave
export async function leaveRoom(req, res) {
  try {
    const userId = req.user.id
    const { roomId } = req.params

    const result = await roomService.leaveRoom(userId, roomId)

    return res.status(200).json({
      success: true,
      message: 'Left room successfully',
    })
  } catch (error) {
    return handleError(res, error)
  }
}

//GET /rooms/:roomId
export async function getRoomDetails(req, res) {
  try {
    const { roomId } = req.params

    const room = await roomService.getRoomDetails(roomId)

    return res.status(200).json({
      success: true,
      room,
    })
  } catch (error) {
    return handleError(res, error)
  }
}
