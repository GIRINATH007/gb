import supabaseServiceRole from '../config/supabase.js'

export async function getFeed(req, res) {
    try {
        const userId = req.user?.id
        if (!userId) return res.status(401).json({ success: false, message: 'Missing authenticated user' })

        // Fetch activities for the user and their confirmed friends
        const { data: friends } = await supabaseServiceRole
            .from('friends')
            .select('friend_id')
            .eq('user_id', userId)

        const userIdsToFetch = [userId, ...(friends?.map(f => f.friend_id) || [])]

        const { data: activities, error } = await supabaseServiceRole
            .from('activities')
            .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(30)

        if (error) throw error

        return res.status(200).json({ success: true, data: activities })
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}