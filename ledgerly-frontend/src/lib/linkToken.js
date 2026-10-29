// One-time values from links: email links (#token=...) and the Google/Microsoft hand-off (#code=...).
//
// The part after # is never sent to any server or in Referer headers. Older ?token= links still work.
// Pages read the value once, then clear it from the address bar so it doesn't stay in the browser
// history, bookmarks or screenshots.
export function readLinkValue(name) {
  return new URLSearchParams(window.location.hash.slice(1)).get(name) || new URLSearchParams(window.location.search).get(name);
}

export function clearLinkFromAddressBar() {
  if (window.location.hash || window.location.search) {
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }
}
