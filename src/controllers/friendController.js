import * as friendService from '../services/friendService.js'

function handleServiceError(res, error, fallbackCode) {
  const statusCode = error.statusCode || 500
  const code = error.code || fallbackCode

  return res.status(statusCode).json({
    success: false,
    message: error.message || 'Request failed',
    code,
  })
}

export async function sendRequest(req, res) {
  try {
    const senderId = req.user?.id
    const { receiver_id: receiverId } = req.body || {}

    if (!senderId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'receiver_id is required',
        code: 'VALIDATION_ERROR',
      })
    }

    await friendService.sendFriendRequest(senderId, receiverId)

    return res.status(201).json({
      success: true,
      message: 'Friend request sent',
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_REQUEST_ERROR')
  }
}

export async function getPending(req, res) {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    const data = await friendService.getPendingRequests(userId)

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_PENDING_ERROR')
  }
}

export async function acceptRequest(req, res) {
  try {
    const userId = req.user?.id
    const { request_id: requestId } = req.body || {}

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'request_id is required',
        code: 'VALIDATION_ERROR',
      })
    }

    await friendService.acceptFriendRequest(userId, requestId)

    return res.status(200).json({
      success: true,
      message: 'Friend request accepted',
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_ACCEPT_ERROR')
  }
}

export async function rejectRequest(req, res) {
  try {
    const userId = req.user?.id
    const { request_id: requestId } = req.body || {}

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'request_id is required',
        code: 'VALIDATION_ERROR',
      })
    }

    await friendService.rejectFriendRequest(userId, requestId)

    return res.status(200).json({
      success: true,
      message: 'Friend request rejected',
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_REJECT_ERROR')
  }
}

export async function getFriends(req, res) {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    const data = await friendService.getFriendsList(userId)

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_LIST_ERROR')
  }
}

export async function searchUsers(req, res) {
  try {
    const userId = req.user?.id
    const { username } = req.query

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    const data = await friendService.searchUsersByUsername(userId, username)

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_SEARCH_ERROR')
  }
}

export async function getFriendProfile(req, res) {
  try {
    const userId = req.user?.id
    const { friendId } = req.params

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Friend ID is required',
        code: 'VALIDATION_ERROR',
      })
    }

    const data = await friendService.getFriendProfileSummary(userId, friendId)

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_PROFILE_ERROR')
  }
}

export async function removeFriend(req, res) {
  try {
    const userId = req.user?.id
    const { friendId } = req.params

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Friend ID is required',
        code: 'VALIDATION_ERROR',
      })
    }

    await friendService.removeFriend(userId, friendId)

    return res.status(200).json({
      success: true,
      message: 'Friend removed',
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_REMOVE_ERROR')
  }
}

export async function getFriendPassport(req, res) {
  try {
    const userId = req.user?.id
    const { friendId } = req.params

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Friend ID is required',
        code: 'VALIDATION_ERROR',
      })
    }

    const data = await friendService.getFriendPassport(userId, friendId)

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    return handleServiceError(res, error, 'FRIEND_PASSPORT_ERROR')
  }
}
