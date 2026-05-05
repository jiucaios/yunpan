const express = require("express");

const { listImageRecords, syncUploadsToDb, toPublicImageRecord } = require("../lib/image-store");
const { searchByText } = require("../lib/vector-service");

const router = express.Router();

router.post("/api/search", async (req, res) => {
  try {
    const query = typeof req.body.query === "string" ? req.body.query.trim() : "";
    const limit = Number.isFinite(Number(req.body.limit)) ? Number(req.body.limit) : 20;

    if (!query) {
      res.status(400).json({
        success: false,
        message: "Query is required."
      });
      return;
    }

    await syncUploadsToDb();
    const images = listImageRecords();
    const searchResult = await searchByText(query, images);

    const results = (searchResult.results || []).slice(0, limit).map((item) => ({
      imageId: item.imageId,
      score: item.score,
      image: toPublicImageRecord(item.image)
    }));

    res.json({
      success: true,
      configured: searchResult.configured,
      query,
      rewrittenQuery: searchResult.rewrittenQuery || query,
      message: searchResult.message || null,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Search failed."
    });
  }
});

module.exports = router;
