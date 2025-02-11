document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const suggestionDiv = document.getElementById('suggestion');
  const sendButton = document.getElementById('send');
  const editButton = document.getElementById('edit');

  // Check if we're on Xfinity chat page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0].url;
    if (!url.includes('xfinity.com')) {
      statusDiv.textContent = 'Please navigate to Xfinity chat';
      return;
    }
  });

  // Listen for suggestions from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'suggestion') {
      suggestionDiv.textContent = message.text;
      statusDiv.textContent = 'Suggestion ready';
    }
  });

  // Send message handlers
  sendButton.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'sendMessage',
        text: suggestionDiv.textContent
      });
    });
  });

  editButton.addEventListener('click', () => {
    suggestionDiv.contentEditable = true;
    suggestionDiv.focus();
  });
});