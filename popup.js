document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const suggestionDiv = document.getElementById('suggestion');
  const sendButton = document.getElementById('send');
  const editButton = document.getElementById('edit');

  // Add settings button
  const settingsButton = document.createElement('button');
  settingsButton.textContent = 'Settings';
  settingsButton.style.marginTop = '10px';
  document.body.appendChild(settingsButton);

  // Add chat history display
  const historyDiv = document.createElement('div');
  historyDiv.id = 'chatHistory';
  historyDiv.style.marginTop = '10px';
  historyDiv.style.maxHeight = '200px';
  historyDiv.style.overflowY = 'auto';
  historyDiv.style.border = '1px solid #ccc';
  historyDiv.style.padding = '10px';
  document.body.appendChild(historyDiv);

  // Request chat history when popup opens
  chrome.runtime.sendMessage({ type: 'getChatHistory' }, (response) => {
    if (response && response.history) {
      displayChatHistory(response.history);
    }
  });

  function displayChatHistory(history) {
    historyDiv.innerHTML = '';
    history.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.style.marginBottom = '5px';
      messageElement.textContent = `${message.role}: ${message.content}`;
      historyDiv.appendChild(messageElement);
    });
  }

  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

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
    if (message.type === 'error') {
      //suggestionDiv.textContent = message.text;
      statusDiv.textContent = 'Error';
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