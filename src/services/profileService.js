import supabase from '../config/supabase.js'

export async function getProfileById(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function createProfile(userId, email, username) {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ id: userId, email, username }])
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateProfileById(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

