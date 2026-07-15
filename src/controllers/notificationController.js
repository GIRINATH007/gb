import supabaseServiceRole from '../config/supabase.js'

export async function getNotifications(req, res) {
    try {
        const userId = req.user?.id
        const { data, error } = await supabaseServiceRole
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return res.status(200).json({ success: true, data })
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export async function markAsRead(req, res) {
    try {
        const userId = req.user?.id
        const { id } = req.params

        const { error } = await supabaseServiceRole
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', userId)

        if (error) throw error
        return res.status(200).json({ success: true, message: 'Notification marked as read' })
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export async function markAllAsRead(req, res) {
    try {
        const userId = req.user?.id
        const { error } = await supabaseServiceRole
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false)

        if (error) throw error
        return res.status(200).json({ success: true, message: 'All notifications marked as read' })
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}