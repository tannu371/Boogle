import "dotenv/config";
import express from "express"; // handle routes and requests
import session from "express-session";
import pg from "pg";
import connectSqlite3 from "connect-sqlite3";
import multer from "multer"; // middleware to handle file uploads
import fs from "fs"; // read file data
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";

const PORT = process.env.PORT || 3000;
const app = express(); // create express application
const SQLiteStore = connectSqlite3(session);
const upload = multer({ dest: "uploads/" }); // Temp folder
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});
db.connect();

app.set("trust proxy", 1);

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db" }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 Day (instead of 6 minutes)
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  }),
);

// This middleware runs on every single request
app.use((req, res, next) => {
  // We attach 'user' to res.locals
  // If logged in, it's the user object; if not, it's null
  res.locals.user = req.session.user || null;

  // You can also set a default for activePage here
  res.locals.activePage = "";

  next(); // Move to the next piece of code (the routes)
});

// Middleware to protect private routes
function ensureAuth(req, res, next) {
  if (req.session.user) {
    return next(); // User is logged in, proceed to the route
  }
  // User is not logged in
  res.redirect("/login");
}

async function getSaved(username) {
  const result = await db.query(
    "SELECT blog_id FROM saved_blog WHERE user_name = $1;",
    [username],
  );
  let saved = [];
  result.rows.forEach((entry) => {
    saved.push(entry.blog_id);
  });
  return saved;
}

// get homepage
app.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * from blogs ORDER BY post_time DESC",
    );

    let saved = [];
    // We still need the check here ONLY to fetch the 'saved' blogs from DB
    if (req.session.user) {
      saved = await getSaved(req.session.user.user_name);
    }

    // Notice: We don't pass 'user' here anymore!
    // res.locals.user is already taking care of it.
    res.render("index.ejs", {
      activePage: "home",
      blogs: result.rows,
      saved: saved,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// blog view
app.get("/blog/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  // 1. Validation: If the ID isn't a number, redirect home early
  if (isNaN(id)) {
    return res.redirect("/");
  }

  try {
    const result = await db.query("SELECT * FROM blogs WHERE id = $1", [id]);

    // 2. Handle 404: If the blog doesn't exist
    if (result.rows.length === 0) {
      return res.status(404).send("Blog not found"); // Or render a 404.ejs
    }

    const blog = result.rows[0];

    // 3. Simple Render: 'user' and 'activePage' are handled by middleware
    res.render("blogView.ejs", {
      activePage: "blog",
      blog: blog,
    });
  } catch (err) {
    console.error("Error fetching blog view:", err);
    res.redirect("/");
  }
});

// The route only runs if ensureAuth calls next()
app.get("/create", ensureAuth, (req, res) => {
  // 'user' and 'activePage' are already handled by your global middleware!
  res.render("modify.ejs", {
    activePage: "create" 
  });
});

// get all saved blogs
// This route now uses the 'ensureAuth' middleware we created
app.get("/saved", ensureAuth, async (req, res) => {
  const username = req.session.user.user_name;

  try {
    // 1. Fetch the full content of blogs the user has saved
    // We use a JOIN so we don't have to run multiple queries for each blog
    const result = await db.query(
      `SELECT b.* FROM blogs b 
       JOIN saved_blog sb ON sb.blog_id = b.id 
       WHERE sb.user_name = $1 
       ORDER BY b.post_time DESC;`,
      [username]
    );

    // 2. Fetch just the list of IDs (for the UI bookmark icons)
    const saved = await getSaved(username);

    // 3. Render index.ejs 
    // No need to pass 'user'—res.locals.user handles it automatically!
    res.render("index.ejs", {
      activePage: "saved",
      blogs: result.rows,
      saved: saved,
    });
  } catch (err) {
    console.error("Error in /saved route:", err);
    res.redirect("/");
  }
});

// GET: Render the Login Page
app.get("/login", (req, res) => {
  // If a user is already logged in, don't show the login page; send them home
  if (req.session.user) {
    return res.redirect("/");
  }

  res.render("logIn.ejs", {
    activePage: "login",
    message: null // Initialize message to avoid EJS "undefined" errors
  });
});

// GET: Render the Signup Page
app.get("/signUp", (req, res) => {
  // 1. Redirect if already logged in
  if (req.session.user) {
    return res.redirect("/");
  }

  // 2. Render with default locals
  res.render("signUp.ejs", {
    activePage: "signup",
    message: null // Keeps the template from crashing if no error exists
  });
});

// register/signup
app.post("/register", upload.single("dp"), async (req, res) => {
  try {
    if (!req.file) {
      return res.render("signUp.ejs", {
        message: "❌ Profile picture is required",
      });
    }

    const { username, email, password } = req.body;

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // verification token + expiry (24 hours)
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // save image
    const { originalname, mimetype, path } = req.file;
    const fileData = fs.readFileSync(path);

    const imageResult = await db.query(
      `INSERT INTO images (name, mimetype, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (data_hash)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [originalname, mimetype, fileData],
    );

    fs.unlinkSync(path);
    const imageId = imageResult.rows[0].id;

    // insert user (UNVERIFIED)
    await db.query(
      `INSERT INTO users (
        user_name,
        email,
        password,
        image_id,
        is_verified,
        verification_token,
        verification_expires
      )
      VALUES ($1, $2, $3, $4, false, $5, $6)`,
      [username, email, hashedPassword, imageId, token, expires],
    );

    // send verification email
    const verifyLink = `${process.env.BASE_URL}/verify/${token}`;

    await transporter.sendMail({
      from: `"Bloogle" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your Bloogle account",
      html: `
    <p>Dear <strong>${username}</strong>,</p>

    <p>Welcome to <strong>Bloogle ✨</strong></p>

    <p>
      Thank you for signing up. Please verify your email address by clicking the link below:
    </p>

    <p style="margin:16px 0;">
      <a href="${verifyLink}"
         style="padding:10px 16px;
                background:#112d42;
                color:#ffffff;
                text-decoration:none;
                border-radius:6px;">
        Verify Email
      </a>
    </p>

    <p>
      ⏳ <strong>This link is valid for 24 hours.</strong><br>
      If you do not verify within this time, you’ll need to sign up again.
    </p>

    <p>
      If you did not create this account, you can safely ignore this email.
    </p>

    <br>
    <p>Regards,<br><strong>Team Bloogle</strong></p>
  `,
    });

    res.render("logIn.ejs", {
      activePage: "login",
      message: "📧 Check your email to verify your account",
    });
  } catch (err) {
    console.error("Register error:", err);

    if (err.code === "23505") {
      return res.render("signUp.ejs", {
        message: "❌ Username already exists",
      });
    }

    res.render("signUp.ejs", {
      message: "❌ Registration failed",
    });
  }
});

// verify
app.get("/verify/:token", async (req, res) => {
  const { token } = req.params;

  const result = await db.query(
    `SELECT * FROM users
     WHERE verification_token = $1
       AND verification_expires > NOW()`,
    [token],
  );

  if (result.rowCount === 0) {
    return res.render("logIn.ejs", {
      activePage: "login",
      message: "❌ Verification link expired or invalid",
    });
  }

  await db.query(
    `UPDATE users
     SET is_verified = true,
         verification_token = NULL,
         verification_expires = NULL
     WHERE verification_token = $1`,
    [token],
  );

  res.render("logIn.ejs", {
    activePage: "login",
    message: "✅ Email verified! You can now log in.",
  });
});

// login and redirect to /
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const result = await db.query("SELECT * FROM users WHERE user_name = $1", [
    username,
  ]);

  if (result.rowCount === 0) {
    return res.render("logIn.ejs", {
      activePage: "login",
      message: "❌ User not found",
    });
  }

  const user = result.rows[0];

  if (!user.is_verified) {
    return res.render("logIn.ejs", {
      activePage: "login",
      message: "📧 Please verify your email before logging in",
    });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.render("logIn.ejs", {
      activepage: "login",
      message: "❌ Incorrect password",
    });
  }

  req.session.user = user;
  res.redirect("/");
});

// update profile
app.post("/update-profile", upload.single("profile"), async (req, res) => {
  const { originalname, mimetype, path } = req.file;
  const fileData = fs.readFileSync(path);
  const userId = req.session.user.id;

  try {
    // Insert into `images` table
    const imageResult = await db.query(
      "INSERT INTO images (name, mimetype, data) VALUES ($1, $2, $3) ON CONFLICT(data_hash) DO UPDATE SET name = EXCLUDED.name RETURNING id",
      [originalname, mimetype, fileData],
    );

    fs.unlinkSync(path); // remove temp file

    const imageId = imageResult.rows[0].id;

    // Update user profile with image reference
    const updatedUser = await db.query(
      "UPDATE users SET image_id = $1 WHERE id = $2 RETURNING *;",
      [imageId, userId],
    );

    req.session.user = updatedUser.rows[0];

    res.redirect("/"); // or wherever your user page is
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to upload profile image");
  }
});

// render images
app.get("/image/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const result = await db.query("SELECT * FROM images WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).send("Image not found");
    }

    const image = result.rows[0];
    res.set("Content-Type", image.mimetype);
    res.send(image.data); // image.data is a Buffer
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// get edit box
app.get("/edit/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await db.query("SELECT * from blogs WHERE id = $1;", [id]);
    const blog = result.rows[0];
    res.render("modify.ejs", {
      activePage: "create",
      blog: blog,
      user: req.session.user,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// post blog and back to /
app.post("/post", upload.single("image"), async (req, res) => {
  const { path, originalname, mimetype } = req.file;
  const fileData = fs.readFileSync(path);

  const writer = req.session.user.user_name;
  const title = req.body.title;
  const description = req.body.description;

  try {
    const result = await db.query(
      "INSERT INTO images(name, data, mimetype) values ($1, $2, $3) ON CONFLICT(data_hash) DO UPDATE SET name = EXCLUDED.name RETURNING id;",
      [originalname, fileData, mimetype],
    );

    const image_id = result.rows[0].id;

    await db.query(
      "INSERT INTO blogs (blog_writer, blog_title, blog_description, image_id) VALUES ($1, $2, $3, $4)",
      [writer, title, description, image_id],
    );
    fs.unlinkSync(path); // remove temp file
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

app.post("/update/:id", upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.id);
  const time = new Date();
  const title = req.body.title;
  const description = req.body.description;

  try {
    let image_id;

    // ✅ Only handle image if user uploaded one
    if (req.file) {
      const { path, originalname, mimetype } = req.file;
      const fileData = fs.readFileSync(path);

      let result = await db.query("SELECT id FROM images WHERE data = $1", [
        fileData,
      ]);

      if (result.rowCount === 0) {
        result = await db.query(
          "INSERT INTO images(name, data, mimetype) VALUES ($1, $2, $3) RETURNING id;",
          [originalname, fileData, mimetype],
        );
      }

      image_id = result.rows[0].id;
      fs.unlinkSync(path); // remove temp file
    }

    // ✅ Update query changes depending on image upload
    if (image_id) {
      await db.query(
        "UPDATE blogs SET post_time = $1, blog_title = $2, blog_description = $3, image_id = $4 WHERE id = $5;",
        [time, title, description, image_id, id],
      );
    } else {
      await db.query(
        "UPDATE blogs SET post_time = $1, blog_title = $2, blog_description = $3 WHERE id = $4;",
        [time, title, description, id],
      );
    }

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

// get user created blogs
app.get("/myPosts", async (req, res) => {
  try {
    const username = req.session.user.user_name;
    const result = await db.query(
      "SELECT * FROM blogs WHERE blog_writer = $1;",
      [username],
    );

    const saved = await getSaved(username);

    res.render("index.ejs", {
      activePage: "myposts",
      user: req.session.user,
      blogs: result.rows,
      saved: saved,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// delete blog
app.post("/delete", async (req, res) => {
  console.log(req.body);
  const blogId = parseInt(req.body.id);
  await db.query("DELETE FROM blogs WHERE id = $1;", [blogId]);
  res.redirect("/");
});

// toggle save
app.post("/save", async (req, res) => {
  const username = req.session.user.user_name;
  const blogId = parseInt(req.body.id);

  const result = await db.query(
    "SELECT * FROM saved_blog WHERE blog_id = $1 AND user_name = $2;",
    [blogId, username],
  );

  if (result.rowCount > 0) {
    await db.query(
      "DELETE FROM saved_blog WHERE blog_id = $1 AND user_name = $2;",
      [blogId, username],
    );
  } else {
    await db.query(
      "INSERT INTO saved_blog(blog_id, user_name) VALUES ($1, $2);",
      [blogId, username],
    );
  }

  res.redirect("/");
});

// logout and redirect to /
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Logout failed");
    } else {
      res.clearCookie("connect.sid"); // 🔐 Clear the session cookie
      res.redirect("/");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
