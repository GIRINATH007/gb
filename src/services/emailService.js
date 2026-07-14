import dns from 'dns'
import nodemailer from 'nodemailer'

// Render can't route IPv6 to Gmail SMTP — force IPv4
dns.setDefaultResultOrder('ipv4first')

const transporter =
  nodemailer.createTransport({

    host: 'smtp.gmail.com',
    port: 465,
    secure: true,

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },

    tls: {
      rejectUnauthorized: false
    },

    connectionTimeout: 15000,
})

export const sendOtpEmail =
  async (email, otp) => {

    try {

      const info =
        await transporter.sendMail({

          from:
            `"GeoLoop" <${process.env.EMAIL_USER}>`,

          to: email,

          subject: 'GeoLoop OTP',

          html: `
            <div>
              <h2>GeoLoop Verification</h2>

              <p>Your OTP is:</p>

              <h1>${otp}</h1>

              <p>
                OTP expires in 5 minutes
              </p>
            </div>
          `
        })

      console.log(
        'EMAIL SENT:',
        info.response
      )

    } catch (error) {

      console.error(
        'EMAIL ERROR:',
        error
      )

      throw error
    }
}