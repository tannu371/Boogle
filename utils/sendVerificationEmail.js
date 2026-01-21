import fs from "fs";
import path from "path";
import { mailProvider, resend, transporter } from "../config/mailer.js";

export async function sendVerificationEmail({
  to,
  username,
  verifyLink,
  templateFile = "verify-email.html",
}) {
  try {
    // build template path
    const templatePath = path.join(process.cwd(), "emails", templateFile);

    // read HTML template
    let html = fs.readFileSync(templatePath, "utf8");

    // replace placeholders
    html = html.replace(/{{username}}/g, username);
    html = html.replace(/{{verifyLink}}/g, verifyLink);

    let result;

    // ---- Choose provider ----
    if (mailProvider === "resend") {
      const response = await resend.emails.send({
        from: "Boogle <onboarding@boogle.space>",
        to,
        subject: "Verify your email",
        html,
      });

      result = {
        provider: "resend",
        respond: response,
      };
    } else if (mailProvider === "nodemailer") {
      const info = await transporter.sendMail({
        from: "Boogle <test@gmail.com>",
        to,
        subject: "Verify your email",
        html,
      });

      result = {
        provider: "nodemailer",
        respond: info,
      };
    } else {
      throw new Error(`Unknown MAIL_PROVIDER: ${mailProvider}`);
    }

    console.log("Verification email sent:", result);
    return result;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    throw error;
  }
}
