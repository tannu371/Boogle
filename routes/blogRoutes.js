import express from "express";
import fs from "fs";
import multer from "multer";
import db from "../config/db.js";
import { ensureAuth } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // This defines 'upload'

async function getSaved(username) {
  try {
    const result = await db.query(
      "SELECT blog_id FROM saved_blog WHERE user_name = $1;",
      [username],
    );

    // .map() creates the array of IDs directly and cleanly
    return result.rows.map((row) => row.blog_id);
  } catch (err) {
    console.error("Error in getSaved helper:", err);
    return []; // Return empty array on error to prevent crashing the UI
  }
}

// GET: Homepage Feed
router.get("/", async (req, res) => {
  try {
    // 1. Fetch all blogs, newest first
    const result = await db.query(
      "SELECT * FROM blogs ORDER BY post_time DESC"
    );

    let saved = [];

    // 2. Check if the visitor is logged in
    // req.isAuthenticated() is a Passport.js method
    if (req.isAuthenticated()) {
      const username = req.user.user_name;
      saved = await getSaved(username);
    }

    // 3. Render the main index page
    res.render("index.ejs", {
      activePage: "home",
      user: req.user || null, // Shared context for Navbar (Login vs Logout)
      blogs: result.rows,
      saved: saved,           // Used to highlight saved bookmarks
    });
  } catch (err) {
    console.error("Homepage error:", err);
    res.status(500).send("Server Error");
  }
});

// GET: Render Blog page
router.get("/blog/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  // 1. Validation: Prevent database errors from non-numeric IDs
  if (isNaN(id)) {
    return res.status(400).send("Invalid Blog ID");
  }

  try {
    // 2. Fetch the specific blog
    const result = await db.query("SELECT * FROM blogs WHERE id = $1", [id]);

    // 3. Handle 404: If the ID doesn't exist in the database
    if (result.rows.length === 0) {
      return res.status(404).render("404.ejs", { user: req.user || null });
    }

    const blog = result.rows[0];

    // 4. Render the full view
    res.render("blogView.ejs", {
      activePage: "blog",
      user: req.user || null, // Allows the template to show/hide "Edit" buttons
      blog: blog,
    });
  } catch (err) {
    console.error("Error fetching blog view:", err);
    res.status(500).send("Server Error");
  }
});

// GET: Render Create Blog Page
router.get("/create", ensureAuth, (req, res) => {
  res.render("modify.ejs", {
    activePage: "create", // Highlights 'Create Post' in your Navbar
    user: req.user, // Provides the logged-in user's data
    blog: null, // Explicitly set blog to null so the form starts empty
  });
});

// GET: Render Edit Blog Page
router.get("/edit/:id", ensureAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  // 1. Validation: Prevent NaN errors
  if (isNaN(id)) {
    return res.status(400).send("Invalid Blog ID");
  }

  try {
    const result = await db.query("SELECT * FROM blogs WHERE id = $1", [id]);

    // 2. Check if blog exists
    if (result.rowCount === 0) {
      return res.status(404).send("Blog not found");
    }

    const blog = result.rows[0];

    // 3. Security: Ownership Check
    // Prevents User A from editing User B's post by typing the ID in the URL
    if (blog.blog_writer !== req.user.user_name) {
      return res.status(403).send("You are not allowed to edit this blog");
    }

    // 4. Render the 'modify.ejs' template
    // We reuse modify.ejs for both 'Create' and 'Edit'
    res.render("modify.ejs", {
      activePage: "create",
      blog: blog,
      user: req.user,
    });
  } catch (err) {
    console.error("Edit fetch error:", err);
    res.status(500).send("Server error");
  }
});

// GET: Render User's Blog
router.get("/myposts", ensureAuth, async (req, res) => {
  const username = req.user.user_name;

  try {
    // 1. Fetch only blogs where the logged-in user is the writer
    const result = await db.query(
      "SELECT * FROM blogs WHERE blog_writer = $1 ORDER BY post_time DESC;",
      [username]
    );

    // 2. Fetch the list of blog IDs this user has saved
    // (This ensures the 'bookmark' icon shows the correct state)
    const saved = await getSaved(username);

    // 3. Render the standard index.ejs template
    // We reuse index.ejs because the layout for "All Posts" and "My Posts" is usually the same
    res.render("index.ejs", {
      activePage: "myposts",
      user: req.user,
      blogs: result.rows,
      saved: saved,
    });
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).send("Server Error");
  }
});

// POST: Post Blog
router.post("/post", ensureAuth, upload.single("image"), async (req, res) => {
  const writer = req.user.user_name;
  const { title, description } = req.body;

  let imageId = null;

  try {
    // 1. Handle image upload if a file was provided
    if (req.file) {
      const { path, originalname, mimetype } = req.file;
      const fileData = fs.readFileSync(path);

      // Save image to the images table
      const imageResult = await db.query(
        `INSERT INTO images (name, data, mimetype)
         VALUES ($1, $2, $3)
         ON CONFLICT (data_hash)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id;`,
        [originalname, fileData, mimetype]
      );

      imageId = imageResult.rows[0].id;

      // 2. Clean up: Delete the temporary file from the 'uploads' folder
      fs.unlinkSync(path); 
    }

    // 3. Insert the new blog post into the blogs table
    await db.query(
      `INSERT INTO blogs (blog_writer, blog_title, blog_description, image_id)
       VALUES ($1, $2, $3, $4);`,
      [writer, title, description, imageId]
    );

    res.redirect("/");
  } catch (err) {
    console.error("Post creation error:", err);
    res.status(500).send("Failed to create a post");
  }
});

// POST: Update Blog
router.post("/update/:id", ensureAuth, upload.single("image"), async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, description } = req.body;
    const username = req.user.user_name;
    const time = new Date();

    try {
      // 1. Ownership Check: Ensure the person editing is the author
      const blogResult = await db.query("SELECT blog_writer FROM blogs WHERE id = $1", [id]);
      
      if (blogResult.rowCount === 0) return res.status(404).send("Blog not found");
      if (blogResult.rows[0].blog_writer !== username) {
        return res.status(403).send("❌ Not authorized to edit this blog");
      }

      let image_id = null;

      // 2. Handle Image: If a new file was uploaded, save it to the DB
      if (req.file) {
        const { path, originalname, mimetype } = req.file;
        const fileData = fs.readFileSync(path);

        const imageResult = await db.query(
          `INSERT INTO images (name, data, mimetype)
           VALUES ($1, $2, $3)
           ON CONFLICT (data_hash) DO UPDATE SET name = EXCLUDED.name
           RETURNING id;`,
          [originalname, fileData, mimetype],
        );

        image_id = imageResult.rows[0].id;
        fs.unlinkSync(path); // Cleanup temp file
      }

      // 3. Update Logic: Conditional update depending on whether the image changed
      if (image_id) {
        await db.query(
          `UPDATE blogs SET post_time = $1, blog_title = $2, blog_description = $3, image_id = $4 WHERE id = $5;`,
          [time, title, description, image_id, id]
        );
      } else {
        await db.query(
          `UPDATE blogs SET post_time = $1, blog_title = $2, blog_description = $3 WHERE id = $4;`,
          [time, title, description, id]
        );
      }

      res.redirect("/");
    } catch (err) {
      console.error("Update error:", err);
      // Fail gracefully by returning the user to the edit form with an error message
      res.status(500).send("Failed to update blog")
    }
});

// POST: Delete Blog
router.post("/delete", ensureAuth, async (req, res) => {
  const blogId = parseInt(req.body.id);
  const username = req.user.user_name; // From Passport session

  // 1. Validation: Prevent NaN errors
  if (isNaN(blogId)) {
    return res.status(400).send("Invalid blog ID");
  }

  try {
    // 2. The Secure Query
    // We don't just check the ID; we check that the WRITER matches the logged-in USER.
    const result = await db.query(
      "DELETE FROM blogs WHERE id = $1 AND blog_writer = $2;",
      [blogId, username]
    );

    // 3. Check if anything was actually deleted
    if (result.rowCount === 0) {
      // If rowCount is 0, the blog either doesn't exist OR the user doesn't own it.
      return res.status(403).send("❌ Not authorized to delete this blog");
    }

    // 4. Success: Send back to homepage
    res.redirect("/");
    
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Failed to delete post");
  }
});

// GET: Render Saved Blog
router.get("/saved", ensureAuth, async (req, res) => {
  const username = req.user.user_name;

  try {
    // 1. Fetch the full content of the saved blogs using a JOIN
    const result = await db.query(
      `SELECT b.* FROM blogs b 
       JOIN saved_blog sb ON sb.blog_id = b.id 
       WHERE sb.user_name = $1 
       ORDER BY b.post_time DESC;`,
      [username]
    );

    // 2. Fetch just the IDs to keep track of "saved" status in the UI
    const saved = await getSaved(username);

    // 3. Render the standard index view
    res.render("index.ejs", {
      activePage: "saved",
      user: req.user,
      blogs: result.rows,
      saved: saved,
    });
  } catch (err) {
    console.error("Route error (/saved):", err);
    res.status(500).send("Server Error");
  }
});

// POST: Toggle Save
router.post("/save", ensureAuth, async (req, res) => {
  const username = req.user.user_name;
  const blogId = parseInt(req.body.id);

  // 1. Validation: Prevent NaN errors in Postgres
  if (isNaN(blogId)) {
    return res.status(400).send("Invalid blog id");
  }

  try {
    // 2. Check if the user has already saved this specific blog
    const result = await db.query(
      "SELECT 1 FROM saved_blog WHERE blog_id = $1 AND user_name = $2;",
      [blogId, username]
    );

    if (result.rowCount === 0) {
      // 3a. If NOT saved yet -> INSERT record
      await db.query(
        "INSERT INTO saved_blog (blog_id, user_name) VALUES ($1, $2);",
        [blogId, username]
      );
    } else {
      // 3b. If ALREADY saved -> DELETE record (Toggle Off)
      await db.query(
        "DELETE FROM saved_blog WHERE blog_id = $1 AND user_name = $2;",
        [blogId, username]
      );
    }

    // 4. Redirect back to the page the user was on
    // Using back() allows users to save from 'myposts' or 'saved' without jumping to homepage
    res.redirect("back"); 
    
  } catch (err) {
    console.error("Save toggle error:", err);
    res.status(500).send("Failed to toggle save");
  }
});


export default router;
