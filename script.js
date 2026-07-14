const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messageList = document.getElementById("messageList");
const chatScroll = document.getElementById("chatScroll");
const newChatButton = document.getElementById("newChatButton");
const historyList = document.getElementById("historyList");
const attachmentList = document.getElementById("attachmentList");
const imageAttachButton = document.getElementById("imageAttachButton");
const fileAttachButton = document.getElementById("fileAttachButton");
const imageInput = document.getElementById("imageInput");
const fileInput = document.getElementById("fileInput");

const LOADING_DELAY_MS = 3200;
const TYPE_INTERVAL_MS = 22;
const CARD_REVEAL_DELAY_MS = 260;
const IMAGE_REVEAL_DELAY_MS = 280;

const ASSISTANT_RESPONSE = {
  intro:
    "사진 속 장소를 분석해 보겠습니다. 건물, 간판, 도로 표지판, 지형, 식생, 언어, 랜드마크 등 보이는 단서를 바탕으로 가장 가능성이 높은 장소를 추정하겠습니다.\n다만 사진만으로는 정확한 위치를 단정할 수 없으며, 추정 결과와 근거를 함께 제공하겠습니다.\n\n분석 결과",
  analyses: [
    {
      label: "a",
      title: "안산 탄도항 · 누에섬 (경기도)",
      image: "assets/a.png",
      points: [
        "가장 가능성이 높은 장소",
        "신뢰도: ★★★★★ (매우 높음)",
        "근거: 바다 위와 방조제 인근에 대형 풍력발전기가 여러 기 설치되어 있음.",
        "근거: 갯벌, 방조제, 해변이 함께 나타나는 독특한 풍경.",
        "근거: 썰물 때 누에섬으로 이어지는 길이 열리는 것이 특징.",
      ],
    },
    {
      label: "b",
      title: "제주 신창 풍차해안도로 (제주시 한경면)",
      image: "assets/b.png",
      points: [
        "가장 가능성이 높은 장소",
        "신뢰도: ★★★★★ (매우 높음)",
        "근거: 해안을 따라 풍력발전기가 길게 늘어서 있음.",
        "근거: 에메랄드빛 바다와 검은 현무암 해안이 함께 보이는 제주의 대표 풍경.",
        "근거: 사진 촬영 명소로도 유명.",
      ],
    },
    {
      label: "c",
      title: "제주 김녕성세기해변",
      image: "assets/c.png",
      points: [
        "가장 가능성이 높은 장소",
        "신뢰도: ★★★★☆ (높음)",
        "근거: 백사장 뒤편과 주변 해안에서 풍력발전기를 함께 볼 수 있음.",
        "근거: 하얀 모래와 맑은 바다가 특징.",
        "근거: 풍력발전기가 해변 풍경의 일부처럼 어우러져 있음.",
      ],
    },
  ],
};

let pendingReplyTimeout = null;
let loadingMessageId = null;
let selectedAttachments = [];
let responseRunId = 0;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatTime(date = new Date()) {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 || 12;
  return `${period} ${displayHour}:${minutes}`;
}

function scrollMessagesToBottom() {
  requestAnimationFrame(() => {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  });
}

function updateSendButtonState() {
  const hasText = messageInput.value.trim().length > 0;
  const hasAttachments = selectedAttachments.length > 0;
  sendButton.disabled = !hasText && !hasAttachments;
}

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function createAssistantAvatar() {
  const avatar = document.createElement("div");
  avatar.className = "assistant-avatar";
  avatar.setAttribute("aria-hidden", "true");
  return avatar;
}

function createMessageRow(role, timeLabel) {
  const row = document.createElement("article");
  row.className = `message-row ${role}`;

  const content = document.createElement("div");
  content.className = "message-content";

  if (role === "assistant") {
    content.appendChild(createAssistantAvatar());
  }

  row.appendChild(content);

  if (timeLabel) {
    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = timeLabel;
    row.appendChild(time);
  }

  return { row, content };
}

function getAttachmentKind(file) {
  return file.type.startsWith("image/") ? "image" : "file";
}

function getAttachmentId(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function normalizeAttachment(file) {
  const kind = getAttachmentKind(file);
  return {
    id: getAttachmentId(file),
    name: file.name,
    kind,
    previewUrl: kind === "image" ? URL.createObjectURL(file) : "",
  };
}

function createAttachmentIcon(kind) {
  const icon = document.createElement("span");
  icon.className = "attachment-chip-icon";
  icon.setAttribute("aria-hidden", "true");

  icon.innerHTML =
    kind === "image"
      ? `
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" stroke="currentColor" stroke-width="1.7" />
          <circle cx="9" cy="10" r="1.7" fill="currentColor" />
          <path
            d="m6.5 16.5 4.2-4.2a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 0 2 0l1.3-1.3a1.4 1.4 0 0 1 2 0l1 1"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      `
      : `
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="m14.5 7-6.8 6.8a3.2 3.2 0 1 0 4.5 4.5L19 11.5a5 5 0 0 0-7-7l-7 7a6.8 6.8 0 1 0 9.6 9.6l6.3-6.3"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      `;

  return icon;
}

function createImageAttachmentCard(attachment, options = {}) {
  const { removable = false, message = false } = options;
  const card = document.createElement("div");
  card.className = `attachment-preview${message ? " is-message" : ""}`;

  const image = document.createElement("img");
  image.className = "attachment-preview-image";
  image.src = attachment.previewUrl;
  image.alt = attachment.name;
  card.appendChild(image);

  if (!message) {
    const meta = document.createElement("div");
    meta.className = "attachment-preview-meta";
    meta.appendChild(createAttachmentIcon("image"));

    const label = document.createElement("span");
    label.className = "attachment-preview-label";
    label.textContent = attachment.name;
    meta.appendChild(label);
    card.appendChild(meta);
  }

  if (removable) {
    const removeButton = document.createElement("button");
    removeButton.className = "attachment-preview-remove";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `${attachment.name} 삭제`);
    removeButton.dataset.attachmentId = attachment.id;
    removeButton.textContent = "×";
    card.appendChild(removeButton);
  }

  return card;
}

function createFileAttachmentChip(attachment, options = {}) {
  const { removable = false, message = false } = options;
  const chip = document.createElement("div");
  chip.className = `attachment-chip${message ? " is-message" : ""}`;
  chip.appendChild(createAttachmentIcon(attachment.kind));

  const label = document.createElement("span");
  label.className = "attachment-chip-label";
  label.textContent = attachment.name;
  chip.appendChild(label);

  if (removable) {
    const removeButton = document.createElement("button");
    removeButton.className = "attachment-chip-remove";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `${attachment.name} 삭제`);
    removeButton.dataset.attachmentId = attachment.id;
    removeButton.textContent = "×";
    chip.appendChild(removeButton);
  }

  return chip;
}

function createAttachmentNode(attachment, options = {}) {
  if (attachment.kind === "image" && attachment.previewUrl) {
    return createImageAttachmentCard(attachment, options);
  }

  return createFileAttachmentChip(attachment, options);
}

function renderAttachmentList() {
  attachmentList.innerHTML = "";

  if (selectedAttachments.length === 0) {
    attachmentList.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  selectedAttachments.forEach((attachment) => {
    fragment.appendChild(createAttachmentNode(attachment, { removable: true }));
  });

  attachmentList.appendChild(fragment);
  attachmentList.hidden = false;
}

function clearAttachments() {
  selectedAttachments = [];
  imageInput.value = "";
  fileInput.value = "";
  renderAttachmentList();
  updateSendButtonState();
}

function addSelectedFiles(fileList) {
  const nextFiles = Array.from(fileList).map(normalizeAttachment);

  nextFiles.forEach((file) => {
    if (!selectedAttachments.some((attachment) => attachment.id === file.id)) {
      selectedAttachments.push(file);
    }
  });

  renderAttachmentList();
  updateSendButtonState();
}

function createUserMessageBody(text) {
  const body = document.createElement("div");
  body.className = "user-message-body";

  const attachmentWrap = document.createElement("div");
  attachmentWrap.className = "user-message-attachments";
  body.appendChild(attachmentWrap);

  if (text) {
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const bubbleText = document.createElement("div");
    bubbleText.className = "bubble-text";
    bubbleText.textContent = text;
    bubble.appendChild(bubbleText);
    body.appendChild(bubble);
  }

  return { body, attachmentWrap };
}

async function revealUserAttachments(container, attachments, runId) {
  for (const attachment of attachments) {
    if (runId !== responseRunId) {
      return false;
    }

    container.appendChild(createAttachmentNode(attachment, { message: true }));
    scrollMessagesToBottom();
    await wait(IMAGE_REVEAL_DELAY_MS);
  }

  return true;
}

async function addUserMessage(text, attachments, runId) {
  const { row, content } = createMessageRow("user", formatTime());
  const { body, attachmentWrap } = createUserMessageBody(text);
  content.appendChild(body);
  messageList.appendChild(row);
  scrollMessagesToBottom();

  if (attachments.length === 0) {
    attachmentWrap.remove();
    return true;
  }

  const completed = await revealUserAttachments(attachmentWrap, attachments, runId);
  if (!completed || runId !== responseRunId) {
    row.remove();
    return false;
  }

  return true;
}

function addLoadingMessage() {
  const loadingId = `loading-${Date.now()}`;
  const { row, content } = createMessageRow("assistant", "");
  row.dataset.loadingId = loadingId;

  const bubble = document.createElement("div");
  bubble.className = "bubble loading-bubble assistant-rich";
  bubble.innerHTML = `
    <div class="loading-state" aria-label="답변 생성 중">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="loading-label">사진과 단서를 분석하고 있어요</div>
    </div>
  `;

  content.appendChild(bubble);
  messageList.appendChild(row);
  scrollMessagesToBottom();
  return loadingId;
}

function removeLoadingMessage(id) {
  if (!id) {
    return;
  }

  const loadingNode = messageList.querySelector(`[data-loading-id="${id}"]`);
  if (loadingNode) {
    loadingNode.remove();
  }
}

function clearPendingResponse() {
  responseRunId += 1;

  if (pendingReplyTimeout) {
    clearTimeout(pendingReplyTimeout);
    pendingReplyTimeout = null;
  }

  if (loadingMessageId) {
    removeLoadingMessage(loadingMessageId);
    loadingMessageId = null;
  }
}

function clearMessages() {
  clearPendingResponse();
  messageList.innerHTML = "";
}

function getPresetResponse(input) {
  void input;
  return ASSISTANT_RESPONSE;
}

function setActiveHistoryItem(targetButton) {
  const items = historyList.querySelectorAll(".history-item");
  items.forEach((item) => item.classList.remove("active"));

  if (targetButton) {
    targetButton.classList.add("active");
  }
}

async function typeText(target, text, runId) {
  let typed = "";

  for (const char of text) {
    if (runId !== responseRunId) {
      return false;
    }

    typed += char;
    target.textContent = typed;
    scrollMessagesToBottom();
    await wait(TYPE_INTERVAL_MS);
  }

  target.classList.remove("is-typing");
  return true;
}

function createAnalysisCardSkeleton(item) {
  const section = document.createElement("section");
  section.className = "analysis-card";

  const head = document.createElement("div");
  head.className = "analysis-card-head";

  const badge = document.createElement("span");
  badge.className = "analysis-card-badge";
  badge.textContent = item.label.toUpperCase();
  head.appendChild(badge);

  const title = document.createElement("div");
  title.className = "analysis-card-title is-typing";
  head.appendChild(title);
  section.appendChild(head);

  const image = document.createElement("img");
  image.className = "analysis-card-image";
  image.src = item.image;
  image.alt = `${item.label} 참고 이미지`;
  section.appendChild(image);

  const bulletList = document.createElement("ul");
  bulletList.className = "analysis-card-list";
  section.appendChild(bulletList);

  return { section, title, image, bulletList };
}

async function revealAnalysisCard(item, container, runId) {
  if (runId !== responseRunId) {
    return false;
  }

  const skeleton = createAnalysisCardSkeleton(item);
  container.appendChild(skeleton.section);
  scrollMessagesToBottom();

  await wait(IMAGE_REVEAL_DELAY_MS);
  if (runId !== responseRunId) {
    return false;
  }

  skeleton.image.classList.add("is-visible");
  scrollMessagesToBottom();
  await wait(CARD_REVEAL_DELAY_MS);

  const typedTitle = await typeText(skeleton.title, `${item.label}. ${item.title}`, runId);
  if (!typedTitle || runId !== responseRunId) {
    return false;
  }

  for (const point of item.points) {
    if (runId !== responseRunId) {
      return false;
    }

    const listItem = document.createElement("li");
    listItem.className = "is-typing";
    skeleton.bulletList.appendChild(listItem);
    scrollMessagesToBottom();

    const typedPoint = await typeText(listItem, point, runId);
    if (!typedPoint || runId !== responseRunId) {
      return false;
    }

    await wait(90);
  }

  return true;
}

async function addAssistantResponse(responseData, runId) {
  const { row, content } = createMessageRow("assistant", formatTime());
  const bubble = document.createElement("div");
  bubble.className = "bubble assistant-rich";

  const textBlock = document.createElement("div");
  textBlock.className = "bubble-text assistant-text assistant-typed-text is-typing";
  bubble.appendChild(textBlock);

  content.appendChild(bubble);
  messageList.appendChild(row);
  scrollMessagesToBottom();

  const completed = await typeText(textBlock, responseData.intro, runId);
  if (!completed || runId !== responseRunId) {
    row.remove();
    return;
  }

  const resultList = document.createElement("div");
  resultList.className = "analysis-card-list-wrap";
  bubble.appendChild(resultList);
  scrollMessagesToBottom();

  for (const item of responseData.analyses) {
    const revealed = await revealAnalysisCard(item, resultList, runId);
    if (!revealed || runId !== responseRunId) {
      row.remove();
      return;
    }
  }
}

async function handleSubmit() {
  const text = messageInput.value.trim();
  const attachments = selectedAttachments.map((attachment) => ({ ...attachment }));

  if (!text && attachments.length === 0) {
    return;
  }

  clearPendingResponse();
  const runId = responseRunId;

  const userRendered = await addUserMessage(text, attachments, runId);
  if (!userRendered || runId !== responseRunId) {
    return;
  }

  messageInput.value = "";
  autoResizeTextarea();
  clearAttachments();

  loadingMessageId = addLoadingMessage();
  const presetResponse = getPresetResponse(text);

  pendingReplyTimeout = window.setTimeout(async () => {
    if (runId !== responseRunId) {
      return;
    }

    removeLoadingMessage(loadingMessageId);
    loadingMessageId = null;
    pendingReplyTimeout = null;
    await addAssistantResponse(presetResponse, runId);
  }, LOADING_DELAY_MS);
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSubmit();
});

messageInput.addEventListener("input", () => {
  autoResizeTextarea();
  updateSendButtonState();
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSubmit();
  }
});

attachmentList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".attachment-chip-remove, .attachment-preview-remove");
  if (!removeButton) {
    return;
  }

  const { attachmentId } = removeButton.dataset;
  selectedAttachments = selectedAttachments.filter((attachment) => attachment.id !== attachmentId);
  renderAttachmentList();
  updateSendButtonState();
});

imageAttachButton.addEventListener("click", () => {
  imageInput.click();
});

fileAttachButton.addEventListener("click", () => {
  fileInput.click();
});

imageInput.addEventListener("change", (event) => {
  addSelectedFiles(event.target.files);
  imageInput.value = "";
});

fileInput.addEventListener("change", (event) => {
  addSelectedFiles(event.target.files);
  fileInput.value = "";
});

newChatButton.addEventListener("click", () => {
  clearMessages();
  clearAttachments();
  messageInput.value = "";
  autoResizeTextarea();
  setActiveHistoryItem(historyList.querySelector(".history-item:last-child"));
  messageInput.focus();
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest(".history-item");
  if (!button) {
    return;
  }

  setActiveHistoryItem(button);
});

autoResizeTextarea();
renderAttachmentList();
updateSendButtonState();
