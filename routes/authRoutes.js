import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import multer from "multer";
import db from "../config/db.js";
import { transporter } from "../config/mailer.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// GET: Login Page
router.get("/login", (req, res) => {
  let message = null;

  // 1. Check for URL Query Parameters (Verification flow)
  if (req.query.verified === "success") {
    message = "✅ Email verified! You can now log in.";
  } else if (req.query.error === "expired") {
    message = "❌ Verification link expired. Please register again.";
  }

  // 2. Check for Passport Failure Messages (Stored in Session)
  // Passport 0.6+ puts these in req.session.messages as an array
  if (!message && req.session.messages && req.session.messages.length > 0) {
    message = req.session.messages[req.session.messages.length - 1];
    // Clear the messages so they don't persist on refresh
    req.session.messages = [];
  }

  res.render("logIn.ejs", {
    activePage: "login",
    message: message, // Now 'message' covers both types of alerts
  });
});

// Handle Login POST
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/", // Where to go if password is correct
    failureRedirect: "/login", // Where to go if login fails
    failureMessage: true, // Tells Passport to save the error message in the session
  }),
);

// GET: Render the Sign-Up page
router.get("/register", (req, res) => {
  // We pass an empty message object so EJS doesn't crash 
  // if you use <%= message %> in the template
  res.render("signUp.ejs", { message: null });
});

// POST: Register User
router.post("/register", upload.single("dp"), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Check duplicate username/email
    const existing = await db.query(
      "SELECT 1 FROM users WHERE user_name = $1 OR email = $2",
      [username, email],
    );

    if (existing.rowCount > 0) {
      return res.render("signUp.ejs", {
        message: "❌ Username or email already exists",
      });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create verification token + expiry (24h)
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 4. Handle optional profile image
    let imageId = null;
    if (req.file) {
      const { originalname, mimetype, path } = req.file;
      const fileData = fs.readFileSync(path);

      const imageResult = await db.query(
        `INSERT INTO images (name, mimetype, data)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [originalname, mimetype, fileData],
      );

      imageId = imageResult.rows[0].id;
      fs.unlinkSync(path); // Remove temp file
    }

    // 5. Insert UNVERIFIED user
    await db.query(
      `INSERT INTO users (
        user_name, email, password, image_id, 
        is_verified, verification_token, verification_expires
      )
      VALUES ($1, $2, $3, $4, false, $5, $6)`,
      [username, email, hashedPassword, imageId, token, expires],
    );

    // 6. Send verification email
    const verifyLink = `${process.env.BASE_URL}/verify/${token}`;

    await transporter.sendMail({
      from: `"Boogle" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your Boogle account",
      html: `
        <p>Dear <strong>${username}</strong>,</p>
        <p>Welcome to <strong>Boogle ✨</strong></p>
        <p>Please verify your email by clicking below:</p>
        <p><a href="${verifyLink}" style="padding:10px 16px; background:#112d42; color:#ffffff; text-decoration:none; border-radius:6px;">Verify Email</a></p>
        <p>⏳ Valid for 24 hours.</p>
        <p>⏳ <strong>This link is valid for 24 hours.</strong></p>
        <p>If you did not create this account, you can ignore this email.</p>
        <p>Regards,<br><strong>Team Boogle</strong></p>
      `,
    });

    // 7. Success redirect
    res.render("logIn.ejs", {
      activePage: "login",
      message: "📧 Check your email to verify your account",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.render("signUp.ejs", {
      message: "❌ Registration failed. Please try again.",
    });
  }
});

// GET: Verify Email Token
router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // 1. Check if the token exists and hasn't expired
    const result = await db.query(
      `SELECT * FROM users 
       WHERE verification_token = $1 
       AND verification_expires > NOW()`,
      [token],
    );

    // 2. If no match or expired, send back to login with an error query
    if (result.rowCount === 0) {
      return res.redirect("/login?error=expired");
    }

    // 3. Update the user as verified and wipe the token data
    await db.query(
      `UPDATE users 
       SET is_verified = true, 
           verification_token = NULL, 
           verification_expires = NULL 
       WHERE verification_token = $1`,
      [token],
    );

    // 4. Success! Redirect to login with a success query
    res.redirect("/login?verified=success");
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).send("An error occurred during verification.");
  }
});

// GET: Logout
router.get("/logout", (req, res, next) => {
  // 1. Tell Passport to log the user out
  req.logout(function (err) {
    if (err) {
      console.error("Logout error:", err);
      return next(err);
    }

    // 2. Destroy the session in the database/store
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return next(err);
      }

      // 3. Clear the session cookie from the user's browser
      res.clearCookie("connect.sid");

      // 4. Send them back to the homepage
      res.redirect("/");
    });
  });
});

export default router;
