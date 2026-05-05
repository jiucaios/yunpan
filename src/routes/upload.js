const path = require("path");
const express = require("express");
const multer = require("multer");
const os = require("os");

const { uploadsDir } = require("../config/uploads");
const {
  createImageRecord,
  markImageVectorStatus,
  toPublicImageRecord,
  updateImageEmbedding
} = require("../lib/image-store");
const { generateImageEmbedding } = require("../lib/vector-service");

const router = express.Router();

function isVercel() {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true" || !!process.env.VERCEL;
}

function createMulter() {
  if (isVercel()) {
    return multer({ storage: multer.memoryStorage() });
  }
  
  const effectiveUploadsDir = uploadsDir || path.join(os.tmpdir(), "yunpan-fallback-uploads");
  
  if (!require("fs").existsSync(effectiveUploadsDir)) {
    require("fs").mkdirSync(effectiveUploadsDir, { recursive: true });
  }
  
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, effectiveUploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    }
  });
  
  return multer({ 
    storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype && file.mimetype.startsWith("image/")) {
        cb(null, true);
        return;
      }
      cb(new Error("Only image files are allowed."));
    }
  });
}

const upload = createMulter();

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

    let imageUrl, fileName;

    if (isVercel()) {
      try {
        const { put } = await import("@vercel/blob");
        const ext = path.extname(req.file.originalname) || ".png";
        fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        
        const options = {
          access: "public"
        };
        
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          options.token = process.env.BLOB_READ_WRITE_TOKEN;
        }
        
        const result = await put(fileName, req.file.buffer, options);
        imageUrl = result.url;
      } catch (blobError) {
        console.error("Blob upload error:", blobError);
        res.status(500).json({
          success: false,
          message: `Failed to upload to Blob: ${blobError.message}`
        });
        return;
      }
    } else {
      fileName = req.file.filename;
      imageUrl = `/uploads/${fileName}`;
    }

    const imageRecord = createImageRecord({
      filename: fileName,
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
