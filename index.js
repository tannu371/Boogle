import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import passport from "passport";
import env from "dotenv";

// 1. Import Configs
import db from "./config/db.js"; // Starts DB connection
import "./config/passport.js"; // Sets up strategies

// 2. Import Routes
import authRoutes from "./routes/authRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";

env.config();
const app = express();
app.set("trust proxy", 1);
const PostgresStore = pgSession(session);

// 3. Global Middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// 4. Session & Passport Init
app.use(
  session({
    store: new PostgresStore({
      pool: db, // Connection pool
      tableName: "session", // The table you just created
      // This tells the store to delete expired sessions every 600 seconds (10 minutes)
      pruneSessionInterval: 600,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day session persistence
      secure: false, // Set to true if you're using HTTPS
      httpOnly: true, // Protects against XSS
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// 5. Global Locals (Available in all EJS files)
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.activePage = "";
  next();
});

// 6. Mount Modular Routes
app.use(authRoutes);
app.use(blogRoutes);
app.use(imageRoutes);

// 7. The Final Piece: Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
