# Bloogle — A Full-Stack Blogging Platform
Bloogle is a full-stack blogging web application built using Node.js, Express, EJS, and PostgreSQL.
It enables users to create, edit, save, and manage blog posts with image uploads and session-based authentication.

This project demonstrates end-to-end web development, including backend APIs, database design, authentication, file handling, and cloud deployment.

---

## 🚀 Features

🔐 User Authentication (Sign up / Log in / Log out)

📝 Create, Edit, Delete Blog Posts

🖼️ Image Uploads (Blogs & Profile Pictures)

📌 Save / Unsave Blogs

👤 View Your Own Posts

🧠 Session-based Login State

🎨 Dynamic UI using EJS Templates

🌍 Production Deployment with PostgreSQL (Render)

---

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* EJS (Embedded JavaScript Templates)

### Backend

* Node.js
* Express.js
* Express-Session
* Multer (file uploads)

### Database

* PostgreSQL
* pg (node-postgres)

### Deployment

* Render (Web Service + PostgreSQL)
* Environment-based configuration
* Secure cookies & SSL in production

## 📁 Project Structure

---

    Bloogle/
    │
    ├── public/
    │   ├── icons/
    │   ├── images/
    │   └── main.css
    │   └── main.js
    │
    ├── views/
    │   ├── partials/
    │   │   ├── header.ejs
    │   │   └── footer.ejs
    │   ├── index.ejs
    │   ├── blogView.ejs
    │   ├── modify.ejs
    │   ├── logIn.ejs
    │   └── signUp.ejs
    │
    ├── uploads/          # temporary file storage
    ├── index.js          # main server file
    ├── package.json
    └── README.md


## ⚙️ Environment Variables
Create a .env file in the root directory:

    PORT=3000
    DATABASE_URL=your_postgresql_connection_string
    SESSION_SECRET=your_secret_key
    NODE_ENV=development
    EMAIL_USER=yourgmail@gmail.com
    EMAIL_PASS=16_character_app_password
    BASE_URL=http://localhost:3000


## 🗄️ Database Schema

    CREATE TABLE images (
    id SERIAL PRIMARY KEY,
    name TEXT,
    data BYTEA,
    mimetype TEXT,
    data_hash TEXT UNIQUE
    );

    CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_name TEXT UNIQUE,
    email TEXT,
    password TEXT,
    image_id INTEGER REFERENCES images(id)
    );

    CREATE TABLE blogs (
    id SERIAL PRIMARY KEY,
    post_time TIMESTAMP DEFAULT now(),
    blog_writer TEXT REFERENCES users(user_name),
    blog_title TEXT,
    blog_description TEXT,
    image_id INTEGER REFERENCES images(id)
    );

    CREATE TABLE saved_blog (
    blog_id INTEGER REFERENCES blogs(id) ON DELETE CASCADE,
    user_name TEXT,
    UNIQUE (blog_id, user_name)
    );

    ALTER TABLE users
    ADD COLUMN is_verified BOOLEAN DEFAULT false,
    ADD COLUMN verification_token TEXT,
    ADD COLUMN verification_expires TIMESTAMP;

## ▶️ Running Locally
### 1️⃣ Clone the repository

    git clone https://github.com/tannu371/Bloogle.git
    cd Bloogle

### 2️⃣ Make sure you have required packages

#### Download and install nvm:
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

#### in lieu of restarting the shell:
    \. "$HOME/.nvm/nvm.sh"


#### Download and install Node.js:
    nvm install node

#### Verify the Node.js version:
    node -v

#### Verify npm version:
    npm -v

#### Install nodemon globally if you want auto restart server on change:
    npm i -g nodemon 

#### Verify nodemon version:
    nodemon -v


### 3️⃣ Install dependencies
    npm install 


### 4️⃣ Start the server
    node index.js
    # or
    npm start
    # or
    npm run dev (To auto-restart on changes)

### 5️⃣ Open in browser
    http://localhost:3000

---

## 🌍 Deployment Notes (Render)

---
## ✨ Future Improvements

* Password hashing (bcrypt)
* Pagination & infinite scrolling
* Search & filtering
* Rich text editor
* AJAX save / unsave
* Role-based access control

---

