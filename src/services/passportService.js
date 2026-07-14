import supabase from '../config/supabase.js'

export async function addVisitedCity(userId, city, country) {
  // Check for duplicates
  const { data: existing, error: err } = await supabase
    .from('visited_cities')
    .select('id')
    .eq('user_id', userId)
    .eq('city', city)
    .eq('country', country)
    .maybeSingle()

  if (err) {
    throw err
  }

  if (existing) {
    const conflictError = new Error('City already visited')
    conflictError.code = 'CITY_ALREADY_VISITED'
    throw conflictError
  }

  const { data, error } = await supabase
    .from('visited_cities')
    .insert([
      {
        user_id: userId,
        city,
        country,
        visited_at: new Date().toISOString()
      },
    ])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      const conflictError = new Error('City already visited')
      conflictError.code = 'CITY_ALREADY_VISITED'
      throw conflictError
    }

    throw error
  }

  return data
}

export async function getVisitedCities(userId) {
  const { data, error } = await supabase
    .from('visited_cities')
    .select('*')
    .eq('user_id', userId)
    .order('visited_at', { ascending: false })

  if (error) {
    throw error
  }

  return data
}
