import passport from "passport";
import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import db from "./db.js"; // Note the path to your db config
import transporter from "./mailer.js";

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query(
        "SELECT * FROM users WHERE user_name = $1",
        [username],
      );

      // 1. Check if user exists
      if (result.rows.length === 0) {
        return cb(null, false, { message: "❌ User not found" });
      }

      const user = result.rows[0];

      // 2. Email Verification check 
      if (!user.is_verified) {
        // 1. Generate a NEW token and expiry
        const newToken = uuidv4();
        const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // 2. Update the user in the background
        await db.query(
          "UPDATE users SET verification_token = $1, verification_expires = $2 WHERE user_name = $3",
          [newToken, newExpires, username],
        );

        // 1. LOG THE LINK IMMEDIATELY (Crucial for testing)
        console.log(`[RESEND DEBUG] Link for ${username}: ${verifyLink}`);

        // 2. Attempt to send mail
        transporter
          .sendMail({
            from: `"Boogle" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Resent: Verify your Boogle account",
            html: `<p>Verify here: <a href="${verifyLink}">${verifyLink}</a></p>`,
          })
          .then(() => console.log("✅ Resend email successful"))
          .catch((err) =>
            console.error("❌ Resend email failed:", err.message),
          );

        return cb(null, false, {
          message:
            "📧 Account not verified. A new link has been sent to your email.",
        });
      }

      // 3. Compare hashed passwords
      const storedHashedPassword = user.password;

      bcrypt.compare(password, storedHashedPassword, (err, valid) => {
        if (err) {
          console.error("Error comparing passwords:", err);
          return cb(err);
        }

        if (valid) {
          // Success: Pass the user object to serializeUser
          return cb(null, user);
        } else {
          // Failure: Wrong password
          return cb(null, false, { message: "❌ Incorrect password" });
        }
      });
    } catch (err) {
      console.error("Database error during verify:", err);
      return cb(err);
    }
  }),
);

// Remember to include your serialize/deserialize functions below this!

// 1. Store ONLY the ID in the session cookie
passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

// 2. Use that ID to fetch the LATEST data from the DB
passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);

    if (result.rows.length > 0) {
      cb(null, result.rows[0]); // req.user is now the full user object
    } else {
      cb(new Error("User not found during deserialization"));
    }
  } catch (err) {
    cb(err);
  }
});


// passport.use(
//   "google",
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "http://localhost:3000/auth/google/boogle",
//       userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
//     },
//     async (accessToken, refreshToken, profile, cb) => {
//       try {
//         const result = await db.query("SELECT * FROM users WHERE email = $1", [
//           profile.email,
//         ]);
//         if (result.rows.length === 0) {
//           const newUser = await db.query(
//             "INSERT INTO users (email, password) VALUES ($1, $2)",
//             [profile.email, "google"],
//           );
//           return cb(null, newUser.rows[0]);
//         } else {
//           return cb(null, result.rows[0]);
//         }
//       } catch (err) {
//         return cb(err);
//       }
//     },
//   ),
// );

export default passport;
