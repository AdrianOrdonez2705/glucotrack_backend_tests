import nodemailer from 'nodemailer';

class EmailService {
  static #getTransporter() {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  static async sendEmail(to, subject, html) {
    const transporter = this.#getTransporter();
    await transporter.sendMail({
      from: `"GlucoTracker" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  }
}

export default EmailService;
