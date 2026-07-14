import { sendTestNotification }
from '../services/fcmService.js'

export async function testNotification(
  req,
  res
) {
  try {

    const { token, name } = req.body

    await sendTestNotification(
      token,
      name
    )

    return res.status(200).json({
      success:true,
      message:'Notification sent'
    })

  } catch(error){

    return res.status(500).json({
      success:false,
      error:error.message
    })

  }
}