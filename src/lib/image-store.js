const fs = require("fs");
const path = require("path");

const { imagesDbPath } = require("../config/data");
const { uploadsDir } = require("../config/uploads");

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);

function readDb() {
  const raw = fs.readFileSync(imagesDbPath, "utf8");
  const parsed = JSON.parse(raw || '{"images":[]}');

  return {
    images: Array.isArray(parsed.images) ? parsed.images : []
  };
}

function writeDb(db) {
  fs.writeFileSync(imagesDbPath, JSON.stringify(db, null, 2));
}

function toPublicImageRecord(record) {
  return {
    id: record.id,
    name: record.name,
    originalName: record.originalName || record.name,
    path: record.path,
    uploadedAt: record.uploadedAt,
    size: record.size,
    mimeType: record.mimeType || null,
    vectorStatus: record.vectorStatus || "pending",
    hasEmbedding: Array.isArray(record.embedding) && record.embedding.length > 0
  };
}

function sortImages(images) {
  return [...images].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

function listImageRecords() {
  const db = readDb();
  return sortImages(db.images);
}

function listImages() {
  return listImageRecords().map(toPublicImageRecord);
}

function getImageById(id) {
  const db = readDb();
  return db.images.find((image) => image.id === id) || null;
}

function saveImageRecord(record) {
  const db = readDb();
  const index = db.images.findIndex((image) => image.id === record.id);

  if (index >= 0) {
    db.images[index] = record;
  } else {
    db.images.push(record);
  }

  db.images = sortImages(db.images);
  writeDb(db);

  return record;
}

function createImageRecord(file) {
  const id = `img_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const record = {
    id,
    name: file.filename,
    originalName: file.originalname || file.filename,
    path: file.path || `/uploads/${file.filename}`,
    uploadedAt: new Date().toISOString(),
    size: file.size || 0,
    mimeType: file.mimetype || null,
    vectorStatus: "pending",
    embedding: null,
    embeddingModel: null,
    embeddingUpdatedAt: null,
    vectorError: null
  };

  saveImageRecord(record);
  return record;
}

function updateImageEmbedding(id, payload) {
  const existing = getImageById(id);

  if (!existing) {
    return null;
  }

  const nextRecord = {
    ...existing,
    embedding: Array.isArray(payload.embedding) ? payload.embedding : null,
    embeddingModel: payload.embeddingModel || existing.embeddingModel || null,
    embeddingUpdatedAt: new Date().toISOString(),
    vectorStatus: payload.vectorStatus || "ready",
    vectorError: payload.vectorError || null
  };

  saveImageRecord(nextRecord);
  return nextRecord;
}

function markImageVectorStatus(id, payload) {
  const existing = getImageById(id);

  if (!existing) {
    return null;
  }

  const nextRecord = {
    ...existing,
    vectorStatus: payload.vectorStatus || existing.vectorStatus,
    vectorError: payload.vectorError || null,
    embeddingUpdatedAt: payload.embeddingUpdatedAt || existing.embeddingUpdatedAt || null
  };

  saveImageRecord(nextRecord);
  return nextRecord;
}

async function syncUploadsToDb() {
  if (process.env.VERCEL) {
    return;
  }
  
  const db = readDb();
  const knownNames = new Set(db.images.map((image) => image.name));
  const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!imageExtensions.has(ext) || knownNames.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(uploadsDir, entry.name);
    const stats = await fs.promises.stat(absolutePath);

    db.images.push({
      id: `img_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
      name: entry.name,
      originalName: entry.name,
      path: `/uploads/${entry.name}`,
      uploadedAt: stats.birthtime.toISOString(),
      size: stats.size,
      mimeType: null,
      vectorStatus: "pending",
      embedding: null,
      embeddingModel: null,
      embeddingUpdatedAt: null,
      vectorError: null
    });
  }

  db.images = sortImages(db.images);
  writeDb(db);
}

async function deleteImage(id) {
  const db = readDb();
  const image = db.images.find((img) => img.id === id);

  if (!image) {
    return false;
  }

  // Remove from database
  db.images = db.images.filter((img) => img.id !== id);
  writeDb(db);

  // Remove from storage
  if (process.env.VERCEL && image.path.startsWith("https://")) {
    try {
      const { del } = await import("@vercel/blob");
      await del(image.path);
    } catch (error) {
      console.error("Error deleting from Blob:", error);
    }
  } else {
    try {
      const filePath = path.join(uploadsDir, image.name);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }

  return true;
}

module.exports = {
  createImageRecord,
  getImageById,
  listImageRecords,
  listImages,
  markImageVectorStatus,
  saveImageRecord,
  syncUploadsToDb,
  toPublicImageRecord,
  updateImageEmbedding,
  deleteImage
};
