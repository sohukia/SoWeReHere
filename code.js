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

// Timestamp (ms) of a course "date" + time such as "07:10:00+00:00"; NaN if unreadable.
// Same convention as generateFixedCode(): drop anything after "+" and read the clock as UTC,
// so the result is an absolute instant that compares correctly with Date.now() in any local time zone.
function courseTimestamp(date, time) {
  if (!date || !time) return NaN;
  return Date.parse(`${date}T${String(time).split("+")[0]}Z`);
}

// Picks the course the code should be shown for: the one in progress, else the next one.
// Courses that already ended are skipped, so the code follows the schedule even if the list is stale.
const DEFAULT_COURSE_MS = 4 * 60 * 60 * 1000;
function pickCourse(list, now = Date.now()) {
  const dated = list
    .map((course) => {
      const start = courseTimestamp(course.date, course.start);
      const end = courseTimestamp(course.endDate || course.date, course.end);
      return { course, start, end: Number.isNaN(end) ? start + DEFAULT_COURSE_MS : end };
    })
    .filter((c) => !Number.isNaN(c.start))
    .sort((a, b) => a.start - b.start);
  const current = dated.find((c) => c.end > now);
  // Nothing upcoming in the list: fall back to the last known course
  return (current || dated[dated.length - 1] || {}).course || list[0];
}
