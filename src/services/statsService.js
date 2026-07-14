import supabase from '../config/supabase.js'

export async function getStatsByUserId(userId) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function createStats(userId) {
  const { data, error } = await supabase
    .from('user_stats')
    .insert([{ user_id: userId }])
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateStatsByUserId(userId, updates) {
  const { data, error } = await supabase
    .from('user_stats')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

async function getProfileProgress(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return data
}

async function updateProfileProgress(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('xp, level')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function incrementStats(userId, { xp = 0, energy = 0, loop_points = 0 }) {
  const [currentStats, currentProgress] = await Promise.all([
    getStatsByUserId(userId),
    getProfileProgress(userId),
  ])

  const newTotalXp = (currentProgress.xp || 0) + xp
  const newLevel = Math.floor(newTotalXp / 100) + 1
  
  const rawUpdatedEnergy = (currentStats.energy || 0) + energy
  const newEnergy = Math.min(rawUpdatedEnergy, 100) // Max energy 100

  const newLoopPoints = (currentStats.loop_points || 0) + loop_points

  const statsUpdates = {
    energy: newEnergy,
    loop_points: newLoopPoints,
  }

  const [updatedStats, updatedProgress] = await Promise.all([
    updateStatsByUserId(userId, statsUpdates),
    updateProfileProgress(userId, {
      xp: newTotalXp,
      level: newLevel,
    }),
  ])

  return {
    ...updatedStats,
    ...updatedProgress,
  }
}
