import admin from '../config/firebase.js'

export async function sendTestNotification(
  fcmToken,
  name
) {
  try {

    const message = {
      token: fcmToken,

      notification: {
        title: 'GeoLoop Test',
        body: 'FCM is working'
      },

      data: {
        type: 'test',
        username: name
      }
    }

    const response =
      await admin.messaging().send(message)

    console.log(
      'Notification sent:',
      response
    )

    return response

  } catch (error) {

    console.error(
      'FCM Error:',
      error
    )

    throw error
  }
}