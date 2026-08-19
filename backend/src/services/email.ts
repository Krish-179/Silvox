import { Resend } from "resend";
import { config } from "../config.js";

const resend = new Resend(config.resendApiKey);

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "verify_email" | "reset_password",
): Promise<void> {
  const isVerify = purpose === "verify_email";
  const subject = isVerify
    ? "Verify your Silvox email"
    : "Reset your Silvox password";
  const heading = isVerify ? "Confirm it's you" : "Reset your password";
  const body = isVerify
    ? "Enter this code to finish setting up your account."
    : "Enter this code to choose a new password.";

  const codeDisplay = code.split("").join("\u2009"); // thin space — legible separation without the width of a full space

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#17161A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#17161A; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width: 420px;" cellpadding="0" cellspacing="0">

            <!-- Logo mark -->
            <tr>
              <td align="center" style="padding-bottom: 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px; height:36px; background-color:#A66B4F; border-radius:6px; text-align:center; vertical-align:middle;">
                      <span style="font-family: 'Courier New', monospace; font-size:13px; font-weight:700; color:#17161A;">SV</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#211F25; border:1px solid #34313A; border-radius:10px; padding:36px 32px;">
                <p style="margin:0 0 6px; font-size:20px; font-weight:600; color:#EBE8E4; font-family: Georgia, 'Times New Roman', serif;">
                  ${heading}
                </p>
                <p style="margin:0 0 28px; font-size:14px; line-height:1.6; color:#928E96;">
                  ${body}
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#17161A; border:1px solid #34313A; border-radius:8px; padding:18px 12px; white-space:nowrap;">
                      <span style="font-family: 'Courier New', monospace; font-size:26px; font-weight:700; letter-spacing:3px; color:#A66B4F; white-space:nowrap;">
                        ${codeDisplay}
                      </span>
                    </td>
                  </tr>
                </table>
                </table>

                <p style="margin:24px 0 0; font-size:12px; color:#928E96; line-height:1.6;">
                  This code expires in <strong style="color:#C4915A;">10 minutes</strong>. If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top: 24px;">
                <p style="margin:0; font-size:11px; color:#66636A; font-family: 'Courier New', monospace;">
                  a circuit breaker for your LLM bill
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  await resend.emails.send({
    from: config.emailFrom,
    to,
    subject,
    html,
  });
}
