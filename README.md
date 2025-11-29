# Chrome-Extension---Linkedin-Interactor

---

📌 LinkedIn Interactor Chrome Extension

Automate Likes & Comments on your LinkedIn Feed


---

🚀 Overview

This Chrome extension allows users to automatically like and comment on posts in their LinkedIn feed.
The user enters:

Like Count

Comment Count


Only when both fields are filled, the Start button becomes active.
On clicking Start:

1. The extension opens the LinkedIn feed (user must be logged in manually).


2. It scrolls the feed to load posts.


3. It auto-likes posts up to the given count.


4. It auto-comments using a generic comment (e.g., “CFBR 🚀”).



This extension is designed for automation learning and DOM-based interaction.


---

📁 Folder Structure

linkedin-auto-engage-extension/
│
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── contentScript.js


🔹 manifest.json

Defines extension metadata, permissions, scripts, and LinkedIn URL matching.

🔹 popup.html

The UI displayed when the extension icon is clicked.
Contains two number inputs and a Start button.

🔹 popup.js

Validates inputs and sends user-entered like/comment counts to contentScript.js.

🔹 background.js

Handles extension-level events (optional in MV3 but useful for redirects or debugging).

🔹 root.js

An optional helper script for shared utility functions (if used in your extension).

🔹 content.js

Main automation script executed inside the LinkedIn webpage.
Handles scrolling, identifying buttons, clicking like, opening comment box, typing, posting comments, etc.


---

🧩 How It Works

1️⃣ User Interface

The popup has two number fields:

Like Count

Comment Count


JavaScript enables the Start button only when both fields have values > 0.


---

2️⃣ Triggering Automation

On Start, popup.js sends a message:

chrome.tabs.sendMessage(tab.id, {
  action: "START",
  likeCount: likeValue,
  commentCount: commentValue
});


---

3️⃣ LinkedIn Automation (contentScript.js)

The content script:

Waits for feed to load

Scrolls to load more posts

Locates Like button using:


button[aria-label="React Like"][aria-pressed="false"]

Locates Comment button using:


button[aria-label*="Comment"]

Opens comment box

Enters generic text

Clicks the comment post button


Counters ensure only the user-specified number of likes/comments are executed.


---

⚙️ Features

✔ Auto-scroll to load posts
✔ Auto-like posts
✔ Auto-comment posts
✔ Button enables only with valid input
✔ Lightweight, DOM-safe automation
✔ Works using stable attributes (aria-label, role, contenteditable)


---

🔒 Permissions Used

"permissions": [
  "activeTab",
  "scripting",
  "tabs"
]

These are required to inject scripts and communicate between popup, background, and active tab.


---

🛠️ Installation (Developer Mode)

1. Download or clone the repository


2. Open chrome://extensions/


3. Enable Developer Mode


4. Click Load Unpacked


5. Select the extension folder


6. The extension icon will appear in the Chrome toolbar




---

🎬 How to Use

1. Log into LinkedIn manually


2. Open your feed


3. Click the extension icon


4. Enter:

Like count

Comment count



5. Press Start


6. The extension begins auto-engagement




---
