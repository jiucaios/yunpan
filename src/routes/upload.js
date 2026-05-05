const path = require("path");
const express = require("express");
const multer = require("multer");

const { uploadsDir } = require("../config/uploads");
const {
  createImageRecord,
  markImageVectorStatus,
  toPublicImageRecord,
  updateImageEmbedding
} = require("../lib/image-store");
const { generateImageEmbedding } = require("../lib/vector-service");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
    return;
  }

  cb(new Error("Only image files are allowed."));
};

const upload = multer({
  storage,
  fileFilter
});

const handleUpload = (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      res.status(400).json({
        success: false,
        message: err.message || "Upload failed."
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No image file uploaded. Use field name 'image'."
      });
      return;
    }

    const imageRecord = createImageRecord(req.file);

    generateImageEmbedding(imageRecord)
      .then((result) => {
        if (!result.configured || !Array.isArray(result.embedding)) {
          markImageVectorStatus(imageRecord.id, {
            vectorStatus: result.configured ? "failed" : "pending",
            vectorError: result.message,
            embeddingUpdatedAt: new Date().toISOString()
          });
          return;
        }

        updateImageEmbedding(imageRecord.id, {
          embedding: result.embedding,
          embeddingModel: result.embeddingModel,
          vectorStatus: "ready",
          vectorError: null
        });
      })
      .catch((error) => {
        markImageVectorStatus(imageRecord.id, {
          vectorStatus: "failed",
          vectorError: error.message || "Vectorization failed during upload.",
          embeddingUpdatedAt: new Date().toISOString()
        });
      });

    res.json({
      success: true,
      image: toPublicImageRecord(imageRecord),
      path: imageRecord.path,
      vector: {
        status: imageRecord.vectorStatus,
        message: "Image saved. Vectorization hook is reserved for the Doubao integration."
      }
    });
  });
};

router.post("/upload", handleUpload);
router.post("/api/upload", handleUpload);

module.exports = router;
