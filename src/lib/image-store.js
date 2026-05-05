function createImageRecord(file) {
  const id = `img_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const record = {
    id,
    name: file.filename || file.name || "unknown",
    originalName: file.originalname || file.filename || file.name || "unknown",
    path: file.path || `/uploads/${file.filename || "unknown"}`,
    uploadedAt: new Date().toISOString(),
    size: file.size || 0,
    mimeType: file.mimetype || file.type || null,
    vectorStatus: "pending",
    embedding: null,
    embeddingModel: null,
    embeddingUpdatedAt: null,
    vectorError: null
  };

  saveImageRecord(record);
  return record;
}
