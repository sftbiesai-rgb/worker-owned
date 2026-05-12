export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, website, phone, email, description } = req.body

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' })
  }

  const message = {
    to: process.env.SUBMISSIONS_EMAIL,
    from: process.env.SMTP_FROM || 'noreply@workerowned.com',
    subject: `New submission: ${name}`,
    text: `Business: ${name}
Website: ${website || 'N/A'}
Phone: ${phone || 'N/A'}
Contact Email: ${email}
Description: ${description || 'N/A'}`,
  }

  try {
    if (process.env.SMTP_HOST) {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
      await transporter.sendMail(message)
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Email send failed:', err)
    return res.status(200).json({ success: true })
  }
}