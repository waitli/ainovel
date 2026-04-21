// ============================================
// Email Utility — Resend API Integration
// ============================================

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'noreply@waitli.top';

interface EmailEnv {
  RESEND_API_KEY: string;
  ADMIN_EMAIL?: string;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(
  env: EmailEnv,
  to: string,
  subject: string,
  html: string
): Promise<{ id: string } | null> {
  try {
    const resp = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Resend API error:', resp.status, errText);
      return null;
    }

    const data = await resp.json<{ id: string }>();
    return data;
  } catch (err) {
    console.error('sendEmail failed:', err);
    return null;
  }
}

/**
 * Send admin notification for new submission or character application
 */
export async function sendAdminNotification(
  env: EmailEnv,
  type: 'book_submission' | 'character_application',
  title: string,
  detailUrl: string,
  approveUrl: string,
  rejectUrl: string
): Promise<void> {
  const typeLabel =
    type === 'book_submission' ? 'New Book Submission' : 'New Character Application';

  const html = buildEmailHtml(`
    <h2 style="color:#7c3aed;margin:0 0 16px">${typeLabel}</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6">${title}</p>
    <div style="margin:24px 0">
      <a href="${detailUrl}" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;margin-right:8px">View Details</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="color:#6b7280;font-size:13px;margin-bottom:12px">Quick Actions:</p>
    <a href="${approveUrl}" style="display:inline-block;padding:8px 18px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;margin-right:8px">Approve</a>
    <a href="${rejectUrl}" style="display:inline-block;padding:8px 18px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Reject</a>
  `);

  await sendEmail(env, env.ADMIN_EMAIL || 'waitli@outlook.com', `[Action Required] ${typeLabel}: ${title}`, html);
}

/**
 * Send registration verification code
 */
export async function sendVerificationEmail(
  env: EmailEnv,
  email: string,
  code: string
): Promise<void> {
  const html = buildEmailHtml(`
    <h2 style="color:#7c3aed;margin:0 0 16px">Verify Your Email</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Welcome to AI Novel Platform! Use the verification code below to complete your registration:
    </p>
    <div style="text-align:center;margin:28px 0">
      <span style="display:inline-block;padding:14px 32px;background:#f3f0ff;border:2px solid #7c3aed;border-radius:8px;font-size:28px;font-weight:bold;letter-spacing:6px;color:#7c3aed">${code}</span>
    </div>
    <p style="color:#6b7280;font-size:13px">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
  `);

  await sendEmail(env, email, 'Your Verification Code — AI Novel Platform', html);
}

/**
 * Wrap content in a professional email layout with purple theme
 */
function buildEmailHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">AI Novel Platform</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px">
            ${bodyContent}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
              &copy; ${new Date().getFullYear()} AI Novel Platform. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
