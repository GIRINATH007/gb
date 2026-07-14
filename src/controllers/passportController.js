import * as passportService from '../services/passportService.js'

export async function addCity(req, res) {
  try {
    const { user_id, city, country } = req.body
    const authenticatedUserId = req.user?.id

    if (!authenticatedUserId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    if (user_id && user_id !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
        code: 'FORBIDDEN',
      })
    }

    if (!city || !country) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: city and country',
      })
    }

    const newCity = await passportService.addVisitedCity(
      authenticatedUserId,
      city,
      country
    )

    return res.status(201).json({
      success: true,
      data: newCity,
    })
  } catch (error) {
    if (error.code === 'CITY_ALREADY_VISITED') {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: error.code
      })
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add visited city',
      code: error.code || 'PASSPORT_ADD_ERROR',
    })
  }
}

export async function getCities(req, res) {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      })
    }

    const cities = await passportService.getVisitedCities(id)

    return res.status(200).json({
      success: true,
      data: cities,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch visited cities',
      code: error.code || 'PASSPORT_FETCH_ERROR',
    })
  }
}
