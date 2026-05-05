const express = require("express");
const path = require("path");

const imagesRouter = require("./routes/images");
const searchRouter = require("./routes/search");
const uploadRouter = require("./routes/upload");
const vectorRouter = require("./routes/vector");
const { uploadsDir } = require("./config/uploads");

const app = express();
const publicDir = path.join(__dirname, "..", "public");

app.use(express.json());
app.use(express.static(publicDir));

if (!process.env.VERCEL) {
  app.use("/uploads", express.static(uploadsDir));
}

app.get("/health", (req, res) => {
  res.json({
    success: true
  });
});

app.use(imagesRouter);
app.use(searchRouter);
app.use(uploadRouter);
app.use(vectorRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error."
  });
});

module.exports = app;
