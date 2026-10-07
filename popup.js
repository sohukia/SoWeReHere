browser.storage.local.get("futureCourses").then(({ futureCourses }) => {
  const msg = document.getElementById("msg");
  // Accept a top-level array, or an object wrapping one (e.g. { data: [...] }).
  const list = Array.isArray(futureCourses)
    ? futureCourses
    : Object.values(futureCourses || {}).find(Array.isArray);
  const first = list && list[0];

  if (!first) {
    msg.textContent = "No data yet";
    return;
  }

  try {
    const code = generateFixedCode(first);
    const button = document.getElementById("copy");
    document.getElementById("code").textContent = code;
    button.hidden = false;
    msg.hidden = true;

    button.addEventListener("click", async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const res = await browser.tabs.sendMessage(tab.id, { type: "fill", code });
        if (!res || !res.ok) throw new Error((res && res.error) || "Fill failed");
        button.classList.add("done");
        setTimeout(() => button.classList.remove("done"), 1500);
      } catch (e) {
        msg.hidden = false;
        msg.textContent = e.message;
      }
    });
  } catch (e) {
    msg.textContent = e.message;
  }
});
