# 📝 Boogle — A Full-Stack Blogging Platform

**Boogle** is a full-stack blogging web application built with **Node.js, Express, EJS, and PostgreSQL**.  
It allows users to create, edit, save, and manage blog posts with image uploads, secure authentication, and email verification.

This project demonstrates **end-to-end web development**, including backend APIs, database design, authentication, file handling, and cloud deployment.

---

## 🚀 Features

🔐 User Authentication (Sign up / Log in / Log out)  
📧 Email Verification before Login  
🔒 Secure Password Hashing (bcrypt)  
📝 Create, Edit, Delete Blog Posts  
🖼️ Image Uploads (Blogs & Profile Pictures)  
📌 Save / Unsave Blogs  
👤 View Your Own Posts  
🧠 Session-based Authentication  
🎨 Dynamic UI using EJS Templates  
🌍 Production Deployment with PostgreSQL (Render)  

---

## 🛠️ Tech Stack

### Frontend
- HTML5  
- CSS3  
- EJS (Embedded JavaScript Templates)

### Backend
- Node.js  
- Express.js  
- Express-Session  
- Multer (file uploads)  
- bcrypt (password hashing)  
- nodemailer (email verification)

### Database
- PostgreSQL  
- pg (node-postgres)

### Deployment
- Render (Web Service + PostgreSQL)  
- Environment-based configuration  
- Secure cookies & SSL in production  

---

## 📁 Project Structure

    Boogle/
    │
    ├── public/
    │ ├── css/
    │ ├── images/
    │ ├── icons/
    │ └── main.js
    │
    ├── views/
    │ ├── partials/
    │ │ ├── header.ejs
    │ │ └── footer.ejs
    │ ├── index.ejs
    │ ├── blogView.ejs
    │ ├── modify.ejs
    │ ├── logIn.ejs
    │ └── signUp.ejs
    │
    ├── uploads/ # temporary file storage
    ├── index.js # main server file
    ├── package.json
    └── README.md


---

## 🗄️ Database Schema

```
            ┌──────────────┐
            │   images     │
            │──────────────│
            │ id (PK)      │◄──────────────┐
            │ name         │               │
            │ data         │               │
            │ mimetype     │               │
            │ data_hash    │               │
            └──────────────┘               │
                   ▲                       │
                   │                       │
         image_id  │                       │ image_id
                   │                       │
            ┌──────────────┐        ┌──────────────┐
            │    users     │        │    blogs     │
            │──────────────│        │──────────────│
            │ id (PK)      │        │ id (PK)      │
            │ user_name    │◄───────┤ blog_writer  │
            │ email        │        │ blog_title   │
            │ password     │        │ description  │
            │ image_id (FK)│        │ image_id(FK) │
            │ is_verified  │        │ post_time    │
            │ token        │        └──────────────┘
            │ expires      │
            └──────────────┘
                   ▲
                   │ user_name
                   │
            ┌──────────────┐
            │  saved_blog  │
            │──────────────│
            │ blog_id (FK) │──────► blogs.id
            │ user_name    │──────► users.user_name
            │ UNIQUE(...)  │
            └──────────────┘
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

    PORT=3000
    DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/YOUR_DB_NAME # or YOUR_postgresql_external_database_url
    SESSION_SECRET=your_session_secret
    NODE_ENV=development # or production (if using render database)

    EMAIL_USER=your_email@gmail.com

    EMAIL_PASS=your_email_app_password
    BASE_URL=http://localhost:3000


> ⚠️ For Gmail, use a **Google App Password**, not your actual Gmail password.

---

## ▶️ Running Locally

### 1️⃣ Clone the repository
    git clone https://github.com/tannu371/Bloogle.git
    cd Bloogle

### 2️⃣ Install Node.js (using nvm)
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    \. "$HOME/.nvm/nvm.sh"
    nvm install node

#### Verify installation:
    node -v
    npm -v

#### (Optional) Install nodemon:
    npm i -g nodemon

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
1. Create a PostgreSQL service on Render
2. Copy the Internal Database URL
3. Create App Password and Copy

    https://myaccount.google.com/apppasswords
4. Create Web Service Project
5. Add required environment variables:

    DATABASE_URL = Paste_your_Render_DATABASE_URL

    SESSION_SECRET = some-long-random-string

    EMAIL_USER = yourgmail@gmail.com

    EMAIL_PASS = Paste_your_app_password

    BASE_URL=https://your-app.onrender.com

    NODE_ENV=production

6. Redeploy after updating environment variables

---

## 🔐 Email Verification Flow
1. User registers → account created as unverified
2. Verification email is sent with a secure token
3. User clicks the verification link
4. Account is marked as verified
5. Login allowed only after verification

---

## ✨ Future Improvements
- Resend verification email
- Forgot password / reset flow
- Pagination & infinite scrolling
- Search & filtering
- Rich text editor
- AJAX save / unsave
- Role-based access control


<!-- To Do
Image ka fix height karna h home(index.js) pe
profile page banana h taki user name aur photo change kar sake waha se, profile ko left/bottom me karna h -->