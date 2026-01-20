import passport from "passport";
import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import db from "./db.js"; // Note the path to your db config

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

      // 2. Block if not verified (Email Verification check)
      if (!user.is_verified) {
        return cb(null, false, {
          message: "📧 Please verify your email first",
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

export default passport;
