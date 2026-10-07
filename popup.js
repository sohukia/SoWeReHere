const msg = document.getElementById("msg");
const copyButton = document.getElementById("copy");
const autoSignButton = document.getElementById("autosign");

const showError = (text) => {
  msg.hidden = false;
  msg.textContent = text;
};

// Sends the code to the page's digit boxes.
const fillCode = async (code) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const res = await browser.tabs.sendMessage(tab.id, { type: "fill", code });
  if (!res || !res.ok) throw new Error((res && res.error) || "Fill failed");
};

document.getElementById("setsig").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});

browser.storage.local.get(["futureCourses", "signature"]).then(({ futureCourses, signature }) => {
  // Accept a top-level array, or an object wrapping one (e.g. { data: [...] }).
  const list = Array.isArray(futureCourses)
    ? futureCourses
    : Object.values(futureCourses || {}).find(Array.isArray);
  const first = list && list.length && pickCourse(list);

  if (!first) {
    msg.textContent = "No data yet";
    return;
  }

  try {
    const code = generateFixedCode(first);
    document.getElementById("code").textContent = code;
    copyButton.hidden = false;
    msg.hidden = true;

    copyButton.addEventListener("click", async () => {
      try {
        await fillCode(code);
        copyButton.classList.add("done");
        setTimeout(() => copyButton.classList.remove("done"), 1500);
      } catch (e) {
        showError(e.message);
      }
    });

    if (signature) {
      autoSignButton.hidden = false;
      autoSignButton.addEventListener("click", async () => {
        try {
          // Flag read by scripts/content.js once the signature page is open.
          await browser.storage.local.set({ autoSignAt: Date.now() });
          await fillCode(code);
          window.close();
        } catch (e) {
          await browser.storage.local.remove("autoSignAt");
          showError(e.message);
        }
      });
    }
  } catch (e) {
    msg.textContent = e.message;
  }
});
