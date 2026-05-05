const fs = require("fs");
const path = require("path");

const { readLocalConfig } = require("./local-config");

const API_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding";
const RESPONSES_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/responses";
const DEFAULT_MODEL = "qwen3-vl-embedding";
const DEFAULT_DIMENSION = 1024;
const DEFAULT_QUERY_REWRITE_MODEL = "qwen3.5-flash";

function normalizeModelName(model) {
  if (!model) {
    return DEFAULT_MODEL;
  }

  if (String(model).toLowerCase() === "qwen3-vl-embedding") {
    return "qwen3-vl-embedding";
  }

  return String(model);
}

function getVectorConfig() {
  const localConfig = readLocalConfig();

  return {
    apiKey:
      process.env.DASHSCOPE_API_KEY ||
      process.env.BAILIAN_API_KEY ||
      localConfig.bailianApiKey ||
      "",
    model: normalizeModelName(
      process.env.BAILIAN_VECTOR_MODEL ||
        localConfig.bailianVectorModel ||
        DEFAULT_MODEL
    ),
    queryRewriteModel:
      process.env.BAILIAN_QUERY_REWRITE_MODEL ||
      localConfig.bailianQueryRewriteModel ||
      DEFAULT_QUERY_REWRITE_MODEL,
    dimension:
      Number(process.env.BAILIAN_VECTOR_DIMENSION || localConfig.bailianVectorDimension) ||
      DEFAULT_DIMENSION
  };
}

function isVectorProviderConfigured() {
  const config = getVectorConfig();
  return Boolean(config.apiKey);
}

function getImageMimeSubtype(imagePath, mimeType) {
  if (mimeType && mimeType.startsWith("image/")) {
    return mimeType.split("/")[1];
  }

  const ext = path.extname(imagePath).replace(".", "").toLowerCase();
  return ext || "png";
}

async function toDataUri(imageRecord) {
  if (imageRecord.path.startsWith("https://")) {
    const response = await fetch(imageRecord.path);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const subtype = getImageMimeSubtype(imageRecord.path, imageRecord.mimeType);
    return `data:image/${subtype};base64,${buffer.toString("base64")}`;
  }

  const localPath = path.join(__dirname, "..", "..", imageRecord.path.replace(/^\//, ""));
  const fileBuffer = fs.readFileSync(localPath);
  const subtype = getImageMimeSubtype(localPath, imageRecord.mimeType);

  return `data:image/${subtype};base64,${fileBuffer.toString("base64")}`;
}

async function requestEmbedding(contents) {
  const config = getVectorConfig();

  if (!config.apiKey) {
    return {
      configured: false,
      success: false,
      message: "Bailian vector provider is not configured yet.",
      embedding: null,
      embeddingModel: null
    };
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input: {
        contents
      },
      parameters: {
        dimension: config.dimension
      }
    })
  });

  const result = await response.json();

  if (!response.ok) {
    const errorMessage =
      result.message || result.code || `Bailian request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  const embedding = result.output?.embeddings?.[0]?.embedding || null;

  return {
    configured: true,
    success: Array.isArray(embedding),
    message: result.message || "",
    embedding,
    embeddingModel: config.model
  };
}

async function rewriteQueryWithLlm(query) {
  const config = getVectorConfig();

  if (!config.apiKey) {
    return {
      success: false,
      rewrittenQuery: query,
      message: "Bailian text model is not configured."
    };
  }

  const response = await fetch(RESPONSES_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.queryRewriteModel,
      input: [
        {
          role: "system",
          content:
            "You rewrite short shopping image search queries for vector retrieval. Output only one concise Chinese search description with product attributes, scene, color, material, and category when possible."
        },
        {
          role: "user",
          content: `Rewrite this query for product image retrieval: ${query}`
        }
      ]
    })
  });

  const result = await response.json();

  if (!response.ok) {
    const errorMessage =
      result.message ||
      result.error?.message ||
      result.code ||
      `Query rewrite failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  const rewrittenQuery =
    result.output_text ||
    result.output?.find((item) => item.type === "message")?.content?.[0]?.text ||
    query;

  return {
    success: true,
    rewrittenQuery: String(rewrittenQuery).trim() || query,
    message: "Query rewritten successfully."
  };
}

async function generateImageEmbedding(imageRecord) {
  try {
    return await requestEmbedding([{ image: await toDataUri(imageRecord) }]);
  } catch (error) {
    return {
      configured: isVectorProviderConfigured(),
      success: false,
      message: error.message || "Image vectorization failed.",
      embedding: null,
      embeddingModel: getVectorConfig().model
    };
  }
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchByText(query, imageRecords) {
  if (!isVectorProviderConfigured()) {
    return {
      configured: false,
      success: false,
      message: "Bailian vector provider is not configured yet.",
      query,
      results: []
    };
  }

  try {
    const rewriteResult = await rewriteQueryWithLlm(query);
    const finalQuery = rewriteResult.rewrittenQuery || query;
    const queryEmbeddingResult = await requestEmbedding([{ text: finalQuery }]);

    if (!Array.isArray(queryEmbeddingResult.embedding)) {
      return {
        configured: true,
        success: false,
        message: "Failed to generate query embedding.",
        query,
        rewrittenQuery: finalQuery,
        results: []
      };
    }

    const results = imageRecords
      .filter((image) => Array.isArray(image.embedding) && image.embedding.length > 0 && image.vectorStatus === 'ready')
      .map((image) => ({
        imageId: image.id,
        score: cosineSimilarity(queryEmbeddingResult.embedding, image.embedding),
        image
      }))
      .sort((a, b) => b.score - a.score)
      .filter((item) => item.score > 0.3);

    return {
      configured: true,
      success: true,
      message: "Vector search completed.",
      query,
      rewrittenQuery: finalQuery,
      results
    };
  } catch (error) {
    return {
      configured: true,
      success: false,
      message: error.message || "Vector search failed.",
      query,
      rewrittenQuery: query,
      results: []
    };
  }
}

module.exports = {
  generateImageEmbedding,
  isVectorProviderConfigured,
  searchByText
};
