import express from "express";
import multer from "multer";
import fs from "fs";
import db from "../config/db.js";
import { ensureAuth } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// GET:Serve Image by ID
router.get("/image/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  // 1. Validation: Prevent "NaN" errors if the URL is /image/something-else
  if (isNaN(id)) {
    return res.status(400).send("Invalid Image ID");
  }

  try {
    const result = await db.query("SELECT * FROM images WHERE id = $1", [id]);

    // 2. Check if image exists in the database
    if (result.rows.length === 0) {
      return res.status(404).send("Image not found");
    }

    const image = result.rows[0];

    // 3. Set Header: Tells the browser "This is an image, not text"
    // image.mimetype was saved during the upload (e.g., 'image/png')
    res.set("Content-Type", image.mimetype);

    // 4. Send Buffer: The raw binary data from the 'data' column
    res.send(image.data); 
    
  } catch (err) {
    console.error("Error serving image:", err);
    res.status(500).send("Internal Server Error");
  }
});


// POST: Update Profile Image
router.post("/update-profile", ensureAuth, upload.single("profile"), async (req, res) => {
    // 1. Validation: Ensure a file was actually selected
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const { originalname, mimetype, path } = req.file;
    const userId = req.user.id; // Use ID from the Passport session

    try {
      // 2. Read the file from the temporary 'uploads' folder
      const fileData = fs.readFileSync(path);

      // 3. Save to 'images' table (using ON CONFLICT to save space if image exists)
      const imageResult = await db.query(
        `INSERT INTO images (name, mimetype, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (data_hash)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [originalname, mimetype, fileData],
      );

      const imageId = imageResult.rows[0].id;

      // 4. Update the user's record to point to the new image ID
      await db.query("UPDATE users SET image_id = $1 WHERE id = $2;", [
        imageId,
        userId,
      ]);

      res.redirect("/");
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).send("Failed to upload profile image");
    } finally {
      // 5. Cleanup: Always delete the temp file, even if the DB query fails
      fs.unlink(path, () => {});
    }
});

export default router;
