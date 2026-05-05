const express = require("express");

const {
  getImageById,
  markImageVectorStatus,
  toPublicImageRecord,
  updateImageEmbedding
} = require("../lib/image-store");
const { generateImageEmbedding, isVectorProviderConfigured } = require("../lib/vector-service");

const router = express.Router();

router.post("/api/images/:id/vectorize", async (req, res) => {
  try {
    const image = getImageById(req.params.id);

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Image not found."
      });
      return;
    }

    markImageVectorStatus(image.id, {
      vectorStatus: "processing",
      vectorError: null,
      embeddingUpdatedAt: new Date().toISOString()
    });

    const result = await generateImageEmbedding(image);

    if (!result.configured || !Array.isArray(result.embedding)) {
      const failedRecord = markImageVectorStatus(image.id, {
        vectorStatus: isVectorProviderConfigured() ? "failed" : "pending",
        vectorError: result.message,
        embeddingUpdatedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        configured: result.configured,
        message: result.message,
        image: failedRecord ? toPublicImageRecord(failedRecord) : null
      });
      return;
    }

    const updated = updateImageEmbedding(image.id, {
      embedding: result.embedding,
      embeddingModel: result.embeddingModel,
      vectorStatus: "ready",
      vectorError: null
    });

    res.json({
      success: true,
      configured: true,
      message: "Image vectorized successfully.",
      image: updated ? toPublicImageRecord(updated) : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Vectorization failed."
    });
  }
});

router.post("/api/vector/reprocess/:id", async (req, res) => {
  try {
    const image = getImageById(req.params.id);

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Image not found."
      });
      return;
    }

    markImageVectorStatus(image.id, {
      vectorStatus: "processing",
      vectorError: null,
      embeddingUpdatedAt: new Date().toISOString()
    });

    const result = await generateImageEmbedding(image);

    if (!result.configured || !Array.isArray(result.embedding)) {
      const failedRecord = markImageVectorStatus(image.id, {
        vectorStatus: isVectorProviderConfigured() ? "failed" : "pending",
        vectorError: result.message,
        embeddingUpdatedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        vector: {
          status: failedRecord ? failedRecord.vectorStatus : "failed",
          message: result.message
        },
        image: failedRecord ? toPublicImageRecord(failedRecord) : null
      });
      return;
    }

    const updated = updateImageEmbedding(image.id, {
      embedding: result.embedding,
      embeddingModel: result.embeddingModel,
      vectorStatus: "ready",
      vectorError: null
    });

    res.json({
      success: true,
      vector: {
        status: "ready",
        message: "Image vectorized successfully."
      },
      image: updated ? toPublicImageRecord(updated) : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Vectorization failed."
    });
  }
});

module.exports = router;
