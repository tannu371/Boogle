CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  data BYTEA NOT NULL,
  mimetype TEXT NOT NULL,
  data_hash TEXT UNIQUE
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  user_name TEXT UNIQUE,
  email TEXT,
  password TEXT,
  image_id INTEGER REFERENCES images(id),
  is_verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  verification_expires TIMESTAMP
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