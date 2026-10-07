const MAX_MODULO = 7872;
const ARRAY_CHARS_NUMERIC = ["8", "3", "4", "9", "1", "6", "2", "5", "7"];

// Port of code.py encode(): digits are NOT reversed at the end.
function encode(chars, num) {
  if (num === 0) return chars[0];
  let result = "";
  while (num > 0) {
    result += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  return result;
}

function generateFixedCode({ id, date, start }) {
  id = Number(id);
  if (!id) throw new Error("Invalid course id");
  if (!date || !start) throw new Error("date and start are required");

  // Same as code.py: drop anything after "+", read the time as UTC.
  const time = String(start).split("+")[0];
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`Invalid date/time: ${date}T${time}`);
  }
  const hour = Number(m[1]);
  const minute = Number(m[2]);

  const r = 173 * id + 79 * hour + 3 * minute;
  return encode(ARRAY_CHARS_NUMERIC, r % MAX_MODULO).padStart(5, "0");
}
