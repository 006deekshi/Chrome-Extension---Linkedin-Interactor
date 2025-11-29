

console.log('[LinkedIn Auto] content script loaded.');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'run') {
    console.log('[LinkedIn Auto] run message received:', msg);
    runAutomation(msg.likeCount, msg.commentCount, msg.commentText).then(result => {
      console.log('[LinkedIn Auto] finished run:', result);
    }).catch(err => {
      console.error('[LinkedIn Auto] run error:', err);
    });
    sendResponse({ accepted: true });
  }
  return true;
});

async function runAutomation(likeCount, commentCount, commentText) {
  const log = (...args) => console.log('[LinkedIn Auto]', ...args);
  log('Starting automation', { likeCount, commentCount, commentText });

  // Utilities
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const randBetween = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const humanDelay = async (min=700, max=1400) => await wait(randBetween(min,max));
  const maxNeeded = Math.max(likeCount || 0, commentCount || 0);

  // Try to gather enough post nodes by scrolling the feed
  let posts = [];
  const maxScrollAttempts = 12;
  let attempt = 0;
  while ((posts.length < maxNeeded) && attempt < maxScrollAttempts) {
    posts = collectPosts();
    log(`Found posts: ${posts.length} (need ${maxNeeded}). Attempt ${attempt+1}/${maxScrollAttempts}`);
    if (posts.length >= maxNeeded) break;
    // scroll down a bit to load more posts
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    await wait(1200 + randBetween(0,800));
    attempt++;
  }

  posts = collectPosts();
  if (!posts || posts.length === 0) {
    log('No posts found on page; aborting.');
    return { liked: 0, commented: 0, reason: 'no posts found' };
  }

  // shuffle to pick random posts
  shuffle(posts);

  // Liking
  let liked = 0;
  const likeTargets = posts.slice(0, Math.min(likeCount, posts.length));
  for (const post of likeTargets) {
    try {
      const likeBtn = findLikeButtonInPost(post);
      if (!likeBtn) {
        log('Like button not found for a post; skipping.');
      } else {
        const ariaPressed = likeBtn.getAttribute('aria-pressed');
        if (ariaPressed === 'true' || /liked/i.test(likeBtn.getAttribute('aria-label') || '')) {
          log('Already liked; skipping.');
        } else {
          likeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await humanDelay(450, 1000);
          likeBtn.click();
          log('Clicked Like button.');
          liked++;
        }
      }
    } catch (e) {
      console.error('Error while liking:', e);
    }
    await humanDelay(800, 1600);
  }

  // Commenting
  let commented = 0;
  // choose posts for commenting — prefer posts not already used for likes
  let commentTargets = posts.slice(likeTargets.length, likeTargets.length + commentCount);
  if (commentTargets.length < commentCount) {
    commentTargets = commentTargets.concat(posts.slice(0, Math.min(posts.length, commentCount - commentTargets.length)));
  }

  for (const post of commentTargets) {
    try {
      // click comment action to open editor
      const commentActionBtn = findCommentActionInPost(post);
      if (commentActionBtn) {
        commentActionBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await humanDelay(400, 900);
        safeClick(commentActionBtn);
        log('Clicked comment action button (to open editor).');
      } else {
        log('No comment action button found; will try to locate editor directly.');
      }

      await humanDelay(600, 1200);

      let editor = findEditorInPost(post);
      if (!editor) {
        log('Editor not found inside post; searching globally.');
        editor = document.querySelector('div.ql-editor[contenteditable="true"], div[data-test-ql-editor-contenteditable="true"], div[contenteditable="true"][aria-label*="comment"]');
      }

      if (!editor) {
        log('No comment editor found; skipping comment for this post.');
      } else {
        // focus and insert text
        editor.focus();
        // Some editors react to innerText change instead of innerHTML; set both
        const escaped = escapeHtml(commentText);
        editor.innerHTML = `<p>${escaped}</p>`;
        editor.textContent = commentText;

        // dispatch input events so LinkedIn updates state
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        await humanDelay(400, 900);

        // Find submit button near the editor or globally (robust)
        const submitBtn = await waitForSubmitButton(post, editor, 4000);
        if (submitBtn) {
          submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await humanDelay(250, 700);
          safeClick(submitBtn);
          log('Submitted comment via submit button.');
          // give LinkedIn some time to process and clear editor
          await wait(900 + randBetween(0,900));
          // Quick verification: editor cleared OR submit button disabled/hidden
          const editorCleared = (editor.textContent || '').trim().length === 0;
          const btnDisabled = submitBtn.disabled || submitBtn.getAttribute('aria-disabled') === 'true' || submitBtn.getAttribute('disabled') !== null;
          log('Post-submit verification:', { editorCleared, btnDisabled });
          commented++;
        } else {
          log('Submit button not found/enabled; trying Ctrl/Cmd+Enter fallback.');
          const fallbackOk = dispatchCtrlEnter(editor);
          if (fallbackOk) {
            log('Ctrl/Cmd+Enter dispatched. Waiting for UI to update...');
            await wait(900 + randBetween(0,900));
            // can't always verify reliably, assume counted
            commented++;
          } else {
            log('Fallback Ctrl/Cmd+Enter failed; comment not posted for this post.');
          }
        }
      }
    } catch (e) {
      console.error('Error while commenting:', e);
    }
    await humanDelay(900, 2000);
  }

  log('Automation complete.', { liked, commented });
  return { liked, commented };

  // ---------------- helper functions ----------------
  function collectPosts() {
    // Many LinkedIn posts present as div[role="article"] or article or feed-shared containers.
    const selectors = [
      'div[role="article"]',
      'article',
      'div.feed-shared-update-v2',
      'div.occludable-update',
      'div.update-components-entity'
    ];
    const nodes = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(n => {
        // simple dedupe by reference
        if (!nodes.includes(n)) nodes.push(n);
      });
    });
    // filter nodes that are visible in the viewport order
    return nodes;
  }

  function findLikeButtonInPost(post) {
    // try aria-label, classes and innerText fallbacks
    let btn = post.querySelector('button[aria-label*="React Like"], button[aria-label*="Like"], button.react-button__trigger');
    if (!btn) {
      // find any button with inner text 'Like' (exact)
      const all = Array.from(post.querySelectorAll('button'));
      btn = all.find(b => (b.innerText || '').trim().toLowerCase() === 'like' ||
                        (b.getAttribute('aria-label') || '').toLowerCase().includes('like'));
    }
    return btn;
  }

  function findCommentActionInPost(post) {
    let btn = post.querySelector('button[aria-label*="Comment"], button[data-control-name="comment"]');
    if (!btn) {
      const all = Array.from(post.querySelectorAll('button'));
      btn = all.find(b => (b.innerText || '').trim().toLowerCase() === 'comment' ||
                         (b.getAttribute('aria-label') || '').toLowerCase().includes('comment'));
    }
    return btn;
  }

  function findEditorInPost(post) {
    // Known editor selectors you provided and common cases
    let editor = post.querySelector('div.ql-editor[contenteditable="true"], div.ql-editor.ql-blank[contenteditable="true"], div[data-test-ql-editor-contenteditable="true"], div.comments-comment-box__texteditor, div[contenteditable="true"][aria-label*="Add a comment"], div[contenteditable="true"][aria-placeholder]');
    // fallback to any contenteditable inside the post
    if (!editor) editor = post.querySelector('[contenteditable="true"]');
    return editor;
  }

  // Wait for submit button to appear and be enabled (prefers post-scoped button then editor-closest then global)
  function waitForSubmitButton(post, editor, timeout = 3000) {
    const selector = 'button.comments-comment-box__submit-button--cr';
    const altSelectors = ['button[aria-label*="Post comment"]', 'button[aria-label*="Comment"]', 'button[type="submit"]'];
    const end = Date.now() + timeout;

    return new Promise(async (resolve) => {
      while (Date.now() < end) {
        // 1) post-scoped
        if (post) {
          const b = post.querySelector(selector) || altSelectors.map(s => post.querySelector(s)).find(Boolean);
          if (b && isVisibleAndEnabled(b)) return resolve(b);
          // also check for a text button inside post
          const textBtn = Array.from(post.querySelectorAll('button')).find(b2 => {
            const txt = (b2.innerText || '').trim().toLowerCase();
            return (txt === 'comment' || txt === 'post' || (b2.getAttribute('aria-label') || '').toLowerCase().includes('comment')) && isVisibleAndEnabled(b2);
          });
          if (textBtn) return resolve(textBtn);
        }

        // 2) editor.closest containers
        if (editor) {
          const closestArticle = editor.closest('div[role="article"], article, div.occludable-update, div.feed-shared-update-v2');
          if (closestArticle) {
            const b2 = closestArticle.querySelector(selector) || altSelectors.map(s => closestArticle.querySelector(s)).find(Boolean);
            if (b2 && isVisibleAndEnabled(b2)) return resolve(b2);
            const textBtn2 = Array.from(closestArticle.querySelectorAll('button')).find(b3 => {
              const txt = (b3.innerText || '').trim().toLowerCase();
              return (txt === 'comment' || txt === 'post' || (b3.getAttribute('aria-label') || '').toLowerCase().includes('comment')) && isVisibleAndEnabled(b3);
            });
            if (textBtn2) return resolve(textBtn2);
          }
        }

        // 3) global search for class
        const globalBtn = document.querySelector(selector) || altSelectors.map(s => document.querySelector(s)).find(Boolean);
        if (globalBtn && isVisibleAndEnabled(globalBtn)) return resolve(globalBtn);

        // 4) global text fallback
        const all = Array.from(document.querySelectorAll('button'));
        const fallback = all.find(b => {
          const txt = (b.innerText || '').trim().toLowerCase();
          return (txt === 'comment' || txt === 'post' || (b.getAttribute('aria-label') || '').toLowerCase().includes('comment')) && isVisibleAndEnabled(b);
        });
        if (fallback) return resolve(fallback);

        await wait(150);
      }
      resolve(null);
    });
  }

  function isVisibleAndEnabled(el) {
    if (!el) return false;
    try {
      const visible = (el.offsetParent !== null) || (el.getClientRects && el.getClientRects().length > 0);
      const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null;
      return visible && !disabled;
    } catch (e) {
      return false;
    }
  }

  // safer click than .click() - dispatch mouse events and fallback to click()
  function safeClick(el) {
    try {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const opts = { view: window, bubbles: true, cancelable: true, clientX: Math.round(cx), clientY: Math.round(cy), button: 0 };
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      try { el.focus(); } catch(e){}
      // final fallback
      setTimeout(() => {
        try { el.click(); } catch(e){}
      }, 30);
    } catch (e) {
      try { el.click(); } catch (ee) { console.error('safeClick error', e, ee); }
    }
  }

  // Fallback: dispatch Ctrl/Cmd+Enter to the editor to try to submit the comment
  function dispatchCtrlEnter(editor) {
    try {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const down = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
        cancelable: true
      });
      const up = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
        cancelable: true
      });
      editor.dispatchEvent(down);
      editor.dispatchEvent(up);
      return true;
    } catch (e) {
      console.error('dispatchCtrlEnter error:', e);
      return false;
    }
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

