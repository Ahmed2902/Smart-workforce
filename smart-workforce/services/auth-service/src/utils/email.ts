import sgMail, { MailDataRequired } from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

export async function sendResetEmail(to: string, resetUrl: string) {
  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: 'Your password Reset link (valid 1 hour)',
    text: `You requested a password reset. Click the link to reset your password:\n\n${resetUrl}\n\nIf you didn't ask, ignore this email.`,
    html: `
      <p>You requested a password reset. Click the link to reset your password (valid 1 hour):</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't ask, ignore this email.</p>
    `,
  };

  await sgMail.send(msg as MailDataRequired);
}
