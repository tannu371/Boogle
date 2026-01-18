import express from "express"; // handle routes and requests
import session from "express-session";
import multer from "multer"; // middleware to handle file uploads
import fs from "fs"; // read file data
import pg from "pg";
import "dotenv/config";

const SQLiteStore = (await import("connect-sqlite3")).default(session);
const upload = multer({ dest: "uploads/" }); // Temp folder

const app = express(); // create express application

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});
db.connect();

export default db;

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    store: new SQLiteStore(),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 360000,
      secure: process.env.NODE_ENV === "production",
    },
  }),
);


async function getSaved(username) {
  const result = await db.query(
    "SELECT blog_id FROM saved_blog WHERE user_name = $1;",
    [username]
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
      "SELECT * from blogs ORDER BY post_time DESC"
    );
    if (req.session.user) {
      const username = req.session.user.user_name;
      const saved = await getSaved(username);
  
      res.render("index.ejs", { user: req.session.user, blogs: result.rows, saved : saved });
    } else {
      res.render("index.ejs", { blogs: result.rows, saved:[] });
    }
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// blog view
app.get("/blog/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * from blogs WHERE id = $1", [
      parseInt(req.params.id),
    ]);
    const blog = result.rows[0];

    if (req.session.user) {
      res.render("blogView.ejs", { user: req.session.user, blog: blog });
    } else {
      res.render("blogView.ejs", { blog: blog });
    }
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// get create page
app.get("/create", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/logIn"); // Redirect if not logged in
  }
  res.render("modify.ejs", { user: req.session.user });
});

// get all saved blogs
app.get("/saved", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/logIn"); // Redirect if not logged in
  }

  const username = req.session.user.user_name;
  const result = await db.query(
    "SELECT * FROM blogs b JOIN saved_blog sb ON sb.blog_id = b.id WHERE sb.user_name = $1 ORDER BY b.post_time DESC;",
    [username]
  );

   const saved = await getSaved(username);

   res.render("index.ejs", {
     user: req.session.user,
     blogs: result.rows,
     saved : saved,
   });
});

// get login page
app.get("/logIn", (req, res) => {
  res.render("logIn.ejs");
});

// get signup page
app.get("/signUp", (req, res) => {
  res.render("signUp.ejs");
});

// register/signup
app.post("/register", upload.single("dp"), async (req, res) => {
  try {
    if (!req.file) {
      return res.render("signUp.ejs", {
        error: "❌ Profile picture is required",
      });
    }

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
    const { username, email, password } = req.body;

    await db.query(
      "INSERT INTO users (user_name, email, password, image_id) VALUES ($1, $2, $3, $4)",
      [username, email, password, imageId],
    );

    res.redirect("/login");
  } catch (err) {
    console.error("Register error:", err);

    if (err.code === "23505") {
      return res.render("signUp.ejs", {
        error: "❌ Username already exists",
      });
    }

    res.render("signUp.ejs", {
      error: "❌ Registration failed. Please try again.",
    });
  }
});


// login and redirect to /
app.post("/", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await db.query("SELECT * from users WHERE user_name = $1;", [
      username,
    ]);

    if (result.rowCount > 0) {
      const user = result.rows[0];
      if (user.password === password) {
        req.session.user = user;
        res.redirect("/");
      } else {
        res.render("logIn.ejs", { message: "Passwords Incorrect!" });
      }
    } else {
      res.render("logIn.ejs", { message: "Username doesn't exist" });
    }
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
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
      [originalname, mimetype, fileData]
    );

    fs.unlinkSync(path); // remove temp file

    const imageId = imageResult.rows[0].id;

    // Update user profile with image reference
    const updatedUser = await db.query("UPDATE users SET image_id = $1 WHERE id = $2 RETURNING *;", [
      imageId,
      userId,
    ]);

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
    res.render("modify.ejs", { blog: blog, user: req.session.user });
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
      [originalname, fileData, mimetype]
    );

    const image_id = result.rows[0].id;

    await db.query(
      "INSERT INTO blogs (blog_writer, blog_title, blog_description, image_id) VALUES ($1, $2, $3, $4)",
      [writer, title, description, image_id]
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
      [username]
    );

    const saved = await getSaved(username);

    res.render("index.ejs", {
      user: req.session.user,
      blogs: result.rows,
      saved : saved,
    });
  } catch (err) {
    console.log(err);
    res.redirect('/');
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
    [blogId, username]
  );

  if (result.rowCount > 0) {
    await db.query(
      "DELETE FROM saved_blog WHERE blog_id = $1 AND user_name = $2;",
      [blogId, username]
    );
  } else {
    await db.query(
      "INSERT INTO saved_blog(blog_id, user_name) VALUES ($1, $2);",
      [blogId, username]
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
