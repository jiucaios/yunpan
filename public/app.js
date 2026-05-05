const uploadForm = document.querySelector("#uploadForm");
const imageInput = document.querySelector("#imageInput");
const selectedFile = document.querySelector("#selectedFile");
const uploadMessage = document.querySelector("#uploadMessage");
const submitButton = document.querySelector("#submitButton");
const gallery = document.querySelector("#gallery");
const galleryHint = document.querySelector("#galleryHint");
const searchInput = document.querySelector("#searchInput");
const imageCount = document.querySelector("#imageCount");
const serviceStatus = document.querySelector("#serviceStatus");
const vectorStatus = document.querySelector("#vectorStatus");
const imageCardTemplate = document.querySelector("#imageCardTemplate");
const semanticQuery = document.querySelector("#semanticQuery");
const semanticSearchButton = document.querySelector("#semanticSearchButton");
const semanticMessage = document.querySelector("#semanticMessage");

let allImages = [];
let vectorConfigured = false;

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Request failed");
  }

  return result;
}

function setMessage(text, type) {
  uploadMessage.textContent = text;
  uploadMessage.className = `message-card ${type}`;
}

function setSemanticMessage(text, type) {
  semanticMessage.textContent = text;
  semanticMessage.className = `message-card ${type}`;
}

function formatTime(value) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderGallery(keyword) {
  const searchValue = keyword.trim().toLowerCase();
  const images = allImages.filter((image) => image.name.toLowerCase().includes(searchValue));

  gallery.innerHTML = "";
  imageCount.textContent = String(images.length);

  console.log("Rendering gallery with images:", images);

  if (!allImages.length) {
    galleryHint.textContent = "暂无图片。请上传一张图片开始。";
    return;
  }

  if (!images.length) {
    galleryHint.textContent = "未找到匹配的图片。";
    return;
  }

  galleryHint.textContent = `显示 ${images.length} 张图片`;

  images.forEach((image) => {
    const card = imageCardTemplate.content.firstElementChild.cloneNode(true);
    const img = card.querySelector("img");
    const name = card.querySelector(".image-name");
    const time = card.querySelector(".image-time");
    const vectorStatus = card.querySelector(".vector-status-value");
    const vectorizeBtn = card.querySelector(".vectorize-btn");
    const deleteBtn = card.querySelector(".delete-btn");
    const link = card.querySelector(".image-link");

    console.log("Image path:", image.path);
    
    img.src = image.path;
    img.alt = image.name || "未命名图片";
    img.onerror = () => {
      console.error("图片加载失败，URL:", image.path);
      img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='100' y='100' text-anchor='middle' dy='.3em' fill='%23999' font-family='sans-serif' font-size='14'%3E图片加载失败%3C/text%3E%3C/svg%3E";
    };
    name.textContent = image.originalName || image.name || "未命名";
    time.textContent = `上传时间: ${formatTime(image.uploadedAt)}`;
    vectorStatus.textContent = image.vectorStatus || "未知";
    link.href = image.path;
    link.textContent = "打开图片";

    if (!vectorConfigured) {
      vectorizeBtn.disabled = true;
      vectorizeBtn.title = "向量服务未配置";
    } else {
      vectorizeBtn.addEventListener("click", async () => {
        vectorizeBtn.disabled = true;
        vectorizeBtn.textContent = "矢量化中...";
        vectorStatus.textContent = "processing";

        try {
          const result = await requestJson(`/api/vector/reprocess/${image.id}`, {
            method: "POST"
          });
          vectorStatus.textContent = result.vector.status;
          await loadImages();
        } catch (error) {
          vectorStatus.textContent = "failed";
          console.error("重新矢量化失败:", error);
        } finally {
          vectorizeBtn.disabled = false;
          vectorizeBtn.textContent = "重新矢量化";
        }
      });
    }

    deleteBtn.addEventListener("click", async () => {
      if (!confirm("确定要删除这张图片吗？")) {
        return;
      }

      deleteBtn.disabled = true;
      deleteBtn.textContent = "删除中...";

      try {
        await requestJson(`/api/images/${image.id}`, {
          method: "DELETE"
        });
        await loadImages();
      } catch (error) {
        console.error("删除失败:", error);
      } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "删除";
      }
    });

    gallery.appendChild(card);
  });
}

async function checkVectorConfig() {
  try {
    const result = await requestJson("/api/config");
    vectorConfigured = result.configured;
    vectorStatus.textContent = vectorConfigured ? "已配置" : "预留";
    
    if (vectorConfigured) {
      setSemanticMessage("向量搜索API已配置，可以使用语义搜索功能。", "success");
    } else {
      setSemanticMessage("向量搜索API已预留。请在后端钩子中插入Doubao模型。", "muted");
    }
  } catch (error) {
    console.error("检查向量配置失败:", error);
    vectorConfigured = false;
    vectorStatus.textContent = "未知";
  }
}

async function loadImages() {
  try {
    serviceStatus.textContent = "在线";
    const result = await requestJson("/api/images");
    console.log("API返回的图片数据:", result);
    allImages = result.images || [];
    
    const hasEmbedding = allImages.some((image) => image.hasEmbedding);
    vectorStatus.textContent = vectorConfigured ? (hasEmbedding ? "已配置" : "已配置") : "预留";
    
    renderGallery(searchInput.value);
  } catch (error) {
    serviceStatus.textContent = "离线";
    gallery.innerHTML = "";
    galleryHint.textContent = error.message || "加载图片失败。";
    console.error("加载图片失败:", error);
  }
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  return requestJson("/api/upload", {
    method: "POST",
    body: formData
  });
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  selectedFile.textContent = file ? `已选择: ${file.name}` : "未选择文件";
});

searchInput.addEventListener("input", () => {
  renderGallery(searchInput.value);
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = imageInput.files[0];
  if (!file) {
    setMessage("请先选择一张图片。", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "上传中...";
  setMessage("正在上传图片...", "muted");

  try {
    const result = await uploadImage(file);
    console.log("上传结果:", result);
    setMessage(
      `上传成功: ${result.path}。向量钩子状态: ${result.vector.status}。`,
      "success"
    );
    uploadForm.reset();
    selectedFile.textContent = "未选择文件";
    await loadImages();
  } catch (error) {
    setMessage(error.message || "上传失败。", "error");
    console.error("上传失败:", error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "上传图片";
  }
});

semanticSearchButton.addEventListener("click", async () => {
  const query = semanticQuery.value.trim();

  if (!query) {
    setSemanticMessage("请先输入语义搜索查询。", "error");
    return;
  }

  if (!vectorConfigured) {
    setSemanticMessage("向量搜索服务未配置，请先配置BAILIAN_API_KEY环境变量。", "error");
    return;
  }

  semanticSearchButton.disabled = true;
  semanticSearchButton.textContent = "搜索中...";
  setSemanticMessage("调用向量搜索API...", "muted");

  try {
    const result = await requestJson("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        limit: 20
      })
    });

    if (!result.configured) {
      setSemanticMessage(result.message || "向量搜索提供程序尚未配置。", "muted");
      return;
    }

    gallery.innerHTML = "";
    
    const resultIds = new Set(result.results.map((item) => item.imageId));
    const matchedImages = allImages.filter((image) => resultIds.has(image.id));
    
    imageCount.textContent = String(matchedImages.length);
    galleryHint.textContent = `语义搜索返回 ${matchedImages.length} 张图片`;
    
    matchedImages.forEach((image) => {
      const card = imageCardTemplate.content.firstElementChild.cloneNode(true);
      const img = card.querySelector("img");
      const name = card.querySelector(".image-name");
      const time = card.querySelector(".image-time");
      const vStatus = card.querySelector(".vector-status-value");
      const vectorizeBtn = card.querySelector(".vectorize-btn");
      const deleteBtn = card.querySelector(".delete-btn");
      const link = card.querySelector(".image-link");

      img.src = image.path;
      img.alt = image.name || "未命名图片";
      name.textContent = image.originalName || image.name || "未命名";
      time.textContent = `上传时间: ${formatTime(image.uploadedAt)}`;
      vStatus.textContent = image.vectorStatus;
      link.href = image.path;

      vectorizeBtn.addEventListener("click", async () => {
        vectorizeBtn.disabled = true;
        vectorizeBtn.textContent = "矢量化中...";
        vStatus.textContent = "processing";

        try {
          const res = await requestJson(`/api/vector/reprocess/${image.id}`, {
            method: "POST"
          });
          vStatus.textContent = res.vector.status;
          await loadImages();
        } catch (error) {
          vStatus.textContent = "failed";
        } finally {
          vectorizeBtn.disabled = false;
          vectorizeBtn.textContent = "重新矢量化";
        }
      });

      deleteBtn.addEventListener("click", async () => {
        if (!confirm("确定要删除这张图片吗？")) return;
        
        deleteBtn.disabled = true;
        deleteBtn.textContent = "删除中...";

        try {
          await requestJson(`/api/images/${image.id}`, { method: "DELETE" });
          await loadImages();
        } catch (error) {
          console.error("删除失败:", error);
        } finally {
          deleteBtn.disabled = false;
          deleteBtn.textContent = "删除";
        }
      });

      gallery.appendChild(card);
    });

    const summaryMessage = result.rewrittenQuery && result.rewrittenQuery !== query
      ? `语义搜索完成。重写的查询: ${result.rewrittenQuery}`
      : result.message || "语义搜索完成。";

    setSemanticMessage(summaryMessage, "success");
  } catch (error) {
    setSemanticMessage(error.message || "语义搜索失败。", "error");
    gallery.innerHTML = "";
    imageCount.textContent = "0";
    galleryHint.textContent = "搜索失败，请重试。";
  } finally {
    semanticSearchButton.disabled = false;
    semanticSearchButton.textContent = "按含义搜索";
  }
});

async function init() {
  await checkVectorConfig();
  await loadImages();
}

init();
