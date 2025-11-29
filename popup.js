const likeInput = document.getElementById('likeCount');
const commentInput = document.getElementById('commentCount');
const startBtn = document.getElementById('startBtn');

function updateButtonState() {
  const likes = likeInput.value;
  const comments = commentInput.value;
  // enable only when both fields have some input (>=1)
  startBtn.disabled = !(likes && comments && Number(likes) > 0 && Number(comments) > 0);
}

likeInput.addEventListener('input', updateButtonState);
commentInput.addEventListener('input', updateButtonState);

startBtn.addEventListener('click', () => {
  const likeCount = Number(likeInput.value) || 0;
  const commentCount = Number(commentInput.value) || 0;
  const commentText = 'CFBR';

  chrome.runtime.sendMessage({
    action: 'startAutomation',
    likeCount,
    commentCount,
    commentText
  }, (resp) => {
    // we close popup; background will inject & run in the LinkedIn tab
    window.close();
  });
});