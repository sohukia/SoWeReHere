// Lets the user store a JPG signature in browser.storage.local (key: "signature", a data: URL).
// This lives in an options page rather than the popup: Firefox closes popups when a file dialog opens.
const MAX_WIDTH = 1000;
const preview = document.getElementById("preview");
const fileInput = document.getElementById("file");
const removeButton = document.getElementById("remove");
const msg = document.getElementById("msg");

const show = (signature) => {
  preview.hidden = !signature;
  removeButton.hidden = !signature;
  if (signature) preview.src = signature;
};

const say = (text, isError) => {
  msg.textContent = text;
  msg.classList.toggle("err", !!isError);
};

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image"));
    image.src = src;
  });

// Downscale + re-encode as JPEG to keep the stored value small.
const normalize = async (file) => {
  const image = await loadImage(await readAsDataURL(file));
  const scale = Math.min(1, MAX_WIDTH / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
};

document.getElementById("choose").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file) return;
  try {
    const signature = await normalize(file);
    await browser.storage.local.set({ signature });
    show(signature);
    say("Signature saved.");
  } catch (e) {
    say(e.message, true);
  }
});

removeButton.addEventListener("click", async () => {
  await browser.storage.local.remove("signature");
  show(null);
  say("Signature removed.");
});

browser.storage.local.get("signature").then(({ signature }) => show(signature));
