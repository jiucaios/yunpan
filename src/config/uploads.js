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

let upload;

if (process.env.VERCEL) {
  upload = multer({ storage: multer.memoryStorage() });
} else {
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
  upload = multer({ storage });
}

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
    return;
  }

  cb(new Error("Only image files are allowed."));
};

upload = multer({
  storage: upload.storage,
  fileFilter
});

const handleUpload = async (req, res) => {
  upload.single("image")(req, res, async (err) => {
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

    let imagePath, imageUrl;
    
    if (process.env.VERCEL) {
      const { put } = await import("@vercel/blob");
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`;
      const result = await put(fileName, req.file.buffer, {
        access: "public"
      });
      imageUrl = result.url;
      imagePath = result.url;
    } else {
      imageUrl = `/uploads/${req.file.filename}`;
      imagePath = `/uploads/${req.file.filename}`;
    }

    const imageRecord = createImageRecord({
      filename: req.file.filename || path.basename(imageUrl),
      originalname: req.file.originalname,
      path: imageUrl,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

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
