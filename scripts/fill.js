// Types a code into the page's digit boxes when the popup asks for it.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function typeDigit(digit) {
  const target = document.activeElement || document.body;
  const init = {
    key: digit,
    code: `Digit${digit}`,
    keyCode: 48 + Number(digit),
    which: 48 + Number(digit),
    bubbles: true,
    cancelable: true,
  };
  target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keypress", init));
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(target.constructor.prototype, "value").set;
    setter.call(target, target.value + digit);
    target.dispatchEvent(new InputEvent("input", { data: digit, inputType: "insertText", bubbles: true }));
  }
  target.dispatchEvent(new KeyboardEvent("keyup", init));
}

async function fillCode(code) {
  const boxes = document.querySelectorAll(".box.cursor-pointer");
  if (!boxes.length) return { ok: false, error: "Code boxes not found" };

  // Focus the first box the way a user would.
  boxes[0].click();
  await sleep(50);

  for (const digit of code) {
    typeDigit(digit);
    await sleep(40);
  }

  const typed = Array.from(boxes, (b) => b.textContent.trim()).join("");
  return typed === code ? { ok: true } : { ok: false, error: `Page shows ${typed}` };
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "fill") return fillCode(msg.code);
});
