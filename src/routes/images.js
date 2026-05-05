const express = require("express");

const { listImages, syncUploadsToDb, deleteImage } = require("../lib/image-store");

const router = express.Router();

const handleListImages = async (req, res) => {
  try {
    await syncUploadsToDb();
    const images = listImages();

    res.json({
      success: true,
      images
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load images."
    });
  }
};

router.get("/images", handleListImages);
router.get("/api/images", handleListImages);

router.delete("/api/images/:id", async (req, res) => {
  try {
    const deleted = await deleteImage(req.params.id);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Image not found."
      });
      return;
    }
    
    res.json({
      success: true,
      message: "Image deleted successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete image."
    });
  }
});

module.exports = router;
