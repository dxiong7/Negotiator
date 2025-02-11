class ChatMonitor {
  constructor() {
    this.chatContainer = null;
    this.inputField = null;
    this.sendButton = null;
    this.observer = null;
    this.setupMonitor();
  }

  setupMonitor() {
    // Wait for chat interface to load
    console.log("Setting up chat monitor");
    const observer = new MutationObserver((mutations, obs) => {
      const chatContainer = document.querySelector('[data-testid="chat-messages-container"]');
      if (chatContainer) {
        console.log("Chat container found");
        this.chatContainer = chatContainer;
        this.inputField = document.querySelector('[data-testid="chat-input"]');
        this.sendButton = document.querySelector('[data-testid="chat-send-button"]');
        this.startMonitoring();
        obs.disconnect();
      } else {
        console.log("Chat container not found");
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  startMonitoring() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          this.checkForNewMessages(mutation.addedNodes);
        }
      }
    });

    this.observer.observe(this.chatContainer, {
      childList: true,
      subtree: true
    });
  }

  checkForNewMessages(nodes) {
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const message = node.querySelector('[data-testid="agent-message"]');
        if (message) {
          this.handleAgentMessage(message.textContent);
        }
      }
    });
  }

  handleAgentMessage(text) {
    chrome.runtime.sendMessage({
      type: 'agentMessage',
      text: text
    });
  }

  async insertMessage(text) {
    if (this.inputField && this.sendButton) {
      // Simulate typing
      const event = new InputEvent('input', { bubbles: true });
      this.inputField.value = text;
      this.inputField.dispatchEvent(event);

      // Small delay to seem more natural
      await new Promise(resolve => setTimeout(resolve, 500));

      // Click send button
      this.sendButton.click();
    }
  }
}

// Initialize chat monitor
const chatMonitor = new ChatMonitor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sendMessage') {
    chatMonitor.insertMessage(message.text);
  }
});