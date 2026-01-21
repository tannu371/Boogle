import nodemailer from "nodemailer";
import { Resend } from "resend";

export const mailProvider = process.env.MAIL_PROVIDER || "nodemailer";

// ---- Resend client ----
export const resend =
  mailProvider === "resend"
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

// ---- Nodemailer transporter ----
export const transporter =
  mailProvider === "nodemailer"
    ? nodemailer.createTransport({
        service: "gmail", // or SMTP config
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;
