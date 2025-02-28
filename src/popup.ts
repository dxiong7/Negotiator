// Basic popup functionality
document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const suggestionDiv = document.getElementById('suggestion') as HTMLDivElement;
  const sendButton = document.getElementById('send') as HTMLButtonElement;
  const editButton = document.getElementById('edit') as HTMLButtonElement;
  const chatHistoryDiv = document.getElementById('chatHistory') as HTMLDivElement;
  const settingsButton = document.getElementById('settings') as HTMLButtonElement;
  const generateButton = document.getElementById('generate') as HTMLButtonElement;
  const spinner = document.querySelector('.loading-spinner') as HTMLElement;
  const suggestionContainer = document.querySelector('.suggestion-container') as HTMLElement;

  // Add proper types for chat history
  interface ChatMessage {
    role: string;
    content: string;
  }

  // Set initial status
  statusDiv.textContent = 'Waiting for messages...';

  function updateChatHistory(history: ChatMessage[]): void {
    if (history && history.length > 0) {
      displayChatHistory(history);
      statusDiv.textContent = 'Chat history updated';
    } else {
      chatHistoryDiv.textContent = 'No messages yet';
      statusDiv.textContent = 'Waiting for new messages';
    }
  }

  // Request full state when popup opens
  chrome.runtime.sendMessage({ type: 'getState' }, (state) => {
    console.log('Received state:', state);
    if (state) {
      updateChatHistory(state.chatHistory);
      
      if (state.currentSuggestion) {
        suggestionDiv.textContent = state.currentSuggestion;
        statusDiv.textContent = 'Suggestion ready';
      }
      
      if (state.lastError) {
        statusDiv.textContent = `Error: ${state.lastError}`;
        statusDiv.classList.add('error');
      }
    } else {
      console.log('No state received');
      chatHistoryDiv.textContent = 'No messages yet';
      statusDiv.textContent = 'Waiting for connection...';
    }
  });

  function displayChatHistory(history: Array<{role: string, content: string}>): void {
    if (!chatHistoryDiv) return;
    
    chatHistoryDiv.innerHTML = '';

    if (history.length === 0) {
      chatHistoryDiv.textContent = 'No messages yet';
      return;
    }

    history.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message');
      messageElement.classList.add(message.role === 'user' ? 'user-message' : 'assistant-message');

      const nameTag = document.createElement('div');
      nameTag.classList.add('name-tag');
      nameTag.textContent = message.role === 'user' ? 'You:' : 'Agent:';
      
      const content = document.createElement('div');
      content.textContent = message.content;

      messageElement.appendChild(nameTag);
      messageElement.appendChild(content);
      chatHistoryDiv.appendChild(messageElement);
    });

    // Scroll to the bottom of the chat history
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
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

  // Update UI state based on suggestion
  function updateUIState(hasSuggestion: boolean) {
    sendButton.disabled = !hasSuggestion;
    editButton.disabled = !hasSuggestion;
    suggestionContainer.classList.toggle('has-suggestion', hasSuggestion);
  }

  // Initially disable secondary buttons
  updateUIState(false);

  // Listen for suggestions from background script
  chrome.runtime.onMessage.addListener((message: { type: string; text?: string }) => {
    if (message.type === 'suggestion' && message.text) {
      suggestionDiv.textContent = message.text;
      statusDiv.textContent = 'Suggestion ready';
      updateUIState(true);
      // Reset loading state
      generateButton.disabled = false;
      spinner.style.display = 'none';
    }
    if (message.type === 'error') {
      statusDiv.textContent = 'Error';
      updateUIState(false);
      // Reset loading state on error too
      generateButton.disabled = false;
      spinner.style.display = 'none';
    }
  });

  // Listen for chat history updates
  chrome.runtime.onMessage.addListener((message: { 
    type: string; 
    text?: string;
    payload?: ChatMessage[];
  }) => {
    if (message.type === 'chatHistoryUpdated' && message.payload) {
      updateChatHistory(message.payload);
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

  // Update generate button handler
  generateButton.addEventListener('click', async () => {
    // Prevent multiple clicks
    if (generateButton.disabled) return;

    try {
      // Show loading state
      generateButton.disabled = true;
      spinner.style.display = 'inline-block';
      statusDiv.textContent = 'Generating response...';
      
      await chrome.runtime.sendMessage({ type: 'generateResponse' });
    } catch (error) {
      statusDiv.textContent = 'Error generating response';
      console.error('Error generating response:', error);
    }
  });
}); 