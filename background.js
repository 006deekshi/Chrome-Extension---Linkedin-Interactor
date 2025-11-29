// background service worker: open/focus LinkedIn feed, inject content script at runtime, send run message

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'startAutomation') {
    const feedUrl = 'https://www.linkedin.com/feed/';
    chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
      let feedTab = tabs.find(t => t.url && t.url.startsWith(feedUrl));
      if (feedTab) {
        chrome.tabs.update(feedTab.id, { active: true }, (tab) => {
          injectAndRun(tab.id, msg);
        });
      } else {
        chrome.tabs.create({ url: feedUrl }, (tab) => {
          // wait a little for page to start loading before injection attempts
          setTimeout(() => injectAndRun(tab.id, msg), 800);
        });
      }
    });
    sendResponse({ started: true });
    return true;
  }
});

function injectAndRun(tabId, msg) {
  // Inject content script file explicitly (ensures it's present) then message it to run.
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['contentScript.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[Background] executeScript error:', chrome.runtime.lastError);
    } else {
      // small delay to let content script initialize
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'run', likeCount: msg.likeCount, commentCount: msg.commentCount, commentText: msg.commentText }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error('[Background] sendMessage error:', chrome.runtime.lastError);
            // show a notification? for now, log.
            chrome.tabs.executeScript(tabId, { code: 'console.error("[LinkedIn Auto] sendMessage failed: ' + (chrome.runtime.lastError.message || '') + '");' });
          } else {
            console.log('[Background] run message sent to content script', resp);
          }
        });
      }, 600);
    }
  });
}