const contactForm = document.querySelector("#contact-form");
const contactList = document.querySelector("#contact-list");
const timerStatus = document.querySelector("#timer-status");
const startCheckin = document.querySelector("#start-checkin");
const cancelCheckin = document.querySelector("#cancel-checkin");
const durationInput = document.querySelector("#duration");
const buildMessage = document.querySelector("#build-message");
const copyMessage = document.querySelector("#copy-message");
const messageBox = document.querySelector("#message");
const nameInput = document.querySelector("#name");
const relationshipInput = document.querySelector("#relationship");
const phoneInput = document.querySelector("#phone");
const locationInput = document.querySelector("#location");
const notesInput = document.querySelector("#notes");

const storageKey = "safeconnect.contacts";
let contacts = [];
let timerId;
let deadline;

function loadContacts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    contacts = Array.isArray(parsed)
      ? parsed.filter((item) => item?.name && item?.relationship && item?.phone)
      : [];
  } catch {
    contacts = [];
  }
}

function persistContacts() {
  localStorage.setItem(storageKey, JSON.stringify(contacts));
}

function renderContactItem(contact, index) {
  const item = document.createElement("li");

  const detailWrap = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = contact.name;
  const meta = document.createElement("small");
  meta.textContent = `${contact.relationship} · ${contact.phone}`;

  detailWrap.append(name, document.createElement("br"), meta);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", `Remove ${contact.name}`);
  removeButton.addEventListener("click", () => {
    contacts.splice(index, 1);
    persistContacts();
    renderContacts();
  });

  item.append(detailWrap, removeButton);
  return item;
}

function renderContacts() {
  contactList.replaceChildren();

  if (!contacts.length) {
    const empty = document.createElement("li");
    empty.textContent = "No trusted contacts yet.";
    contactList.append(empty);
    return;
  }

  contacts.forEach((contact, index) => {
    contactList.append(renderContactItem(contact, index));
  });
}

function setStatus(text) {
  timerStatus.textContent = text;
}

function clearTimer() {
  clearInterval(timerId);
  timerId = undefined;
  deadline = undefined;
}

function updateTimerStatus() {
  if (!deadline) {
    setStatus("No active check-in.");
    return;
  }

  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    clearTimer();
    setStatus("Check-in time expired. Share your SOS message with a trusted contact now.");
    return;
  }

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  setStatus(`Check-in active: ${mins}:${secs} remaining.`);
}

function getSanitizedContact() {
  return {
    name: nameInput.value.trim(),
    relationship: relationshipInput.value.trim(),
    phone: phoneInput.value.trim(),
  };
}

function buildSosMessage() {
  const location = locationInput.value.trim() || "unknown location";
  const notes = notesInput.value.trim() || "No additional notes.";
  const contactNames = contacts.length
    ? contacts.map((contact) => contact.name).join(", ")
    : "my trusted contacts";

  return `SOS ALERT\nI may need help.\nLocation: ${location}\nDetails: ${notes}\nPlease check in with me and contact emergency services if needed.\nNotify: ${contactNames}.`;
}

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const contact = getSanitizedContact();
  if (!contact.name || !contact.relationship || !contact.phone) {
    return;
  }

  contacts.push(contact);
  persistContacts();
  renderContacts();
  contactForm.reset();
  nameInput.focus();
});

startCheckin.addEventListener("click", () => {
  const duration = Number(durationInput.value);
  if (!Number.isFinite(duration) || duration < 1 || duration > 180) {
    setStatus("Please enter a valid duration between 1 and 180 minutes.");
    return;
  }

  deadline = Date.now() + duration * 60 * 1000;
  clearInterval(timerId);
  timerId = setInterval(updateTimerStatus, 1000);
  updateTimerStatus();
});

cancelCheckin.addEventListener("click", () => {
  clearTimer();
  setStatus("Check-in canceled.");
});

buildMessage.addEventListener("click", () => {
  messageBox.value = buildSosMessage();
});

copyMessage.addEventListener("click", async () => {
  if (!messageBox.value) {
    messageBox.value = buildSosMessage();
  }

  try {
    await navigator.clipboard.writeText(messageBox.value);
    setStatus("SOS message copied to clipboard.");
  } catch {
    setStatus("Could not copy automatically. Select the message and copy manually.");
  }
});

loadContacts();
renderContacts();
updateTimerStatus();
