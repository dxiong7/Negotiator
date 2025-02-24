// Basic popup functionality
document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const suggestionDiv = document.getElementById('suggestion') as HTMLDivElement;
  const sendButton = document.getElementById('send') as HTMLButtonElement;
  const editButton = document.getElementById('edit') as HTMLButtonElement;

  // Add settings button
  const settingsButton = document.createElement('button');
  settingsButton.textContent = 'Settings';
  settingsButton.style.marginTop = '10px';
  document.body.appendChild(settingsButton);

  // Add proper types for chat history
  interface ChatMessage {
    role: string;
    content: string;
  }

  // Add chat history display
  const historyDiv = document.createElement('div');
  historyDiv.id = 'chatHistory';
  historyDiv.style.marginTop = '10px';
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

  function displayChatHistory(history: ChatMessage[]) {
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
    const url = tabs[0]?.url;
    if (!url?.includes('xfinity.com')) {
      statusDiv.textContent = 'Please navigate to Xfinity chat';
      return;
    }
  });

  // Listen for suggestions from background script
  chrome.runtime.onMessage.addListener((message: { type: string; text?: string }, sender, sendResponse) => {
    if (message.type === 'suggestion' && message.text) {
      suggestionDiv.textContent = message.text;
      statusDiv.textContent = 'Suggestion ready';
    }
    if (message.type === 'error') {
      statusDiv.textContent = 'Error';
    }
  });

  // Send message handlers
  sendButton.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'sendMessage',
          text: suggestionDiv.textContent
        });
      }
    });
  });

  editButton.addEventListener('click', () => {
    suggestionDiv.contentEditable = 'true';
    suggestionDiv.focus();
  });
}); 