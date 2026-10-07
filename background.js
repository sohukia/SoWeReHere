// Firefox-only: filterResponseData lets us read a response body as it streams in.
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const filter = browser.webRequest.filterResponseData(details.requestId);
    const decoder = new TextDecoder("utf-8");
    let body = "";

    filter.ondata = (event) => {
      body += decoder.decode(event.data, { stream: true });
      filter.write(event.data); // pass data through untouched
    };

    filter.onstop = () => {
      body += decoder.decode();
      filter.close();
      try {
        const data = JSON.parse(body);
        console.log("[SoWeHere] future-courses:", data);
        browser.storage.local.set({ futureCourses: data });
      } catch (e) {
        console.log("[SoWeHere] future-courses (raw):", body);
      }
    };

    filter.onerror = () => console.error("[SoWeHere] filter error:", filter.error);
  },
  { urls: ["*://app.sowesign.com/api/student-portal/future-courses*"] },
  ["blocking"]
);
