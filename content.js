class ChatMonitor {
  constructor() {
    this.chatContainer = null;
    this.inputField = null;
    this.sendButton = null;
    this.observer = null;
    this.setupMonitor();
  }

  setupMonitor() {
    console.log("Setting up chat monitor");
    const observer = new MutationObserver((mutations, obs) => {
      // Log all potential chat-related elements for debugging
      console.log("Searching for chat elements...");
      
      // Updated selectors based on the actual HTML structure
      const chatContainer = document.querySelector('#message-list');
      const inputField = document.querySelector('textarea[name="utterance-input"]');
      const sendButton = document.querySelector('span.send.icon-send-outline[role="button"]');

      if (chatContainer && inputField && sendButton) {
        console.log("Chat elements found:", {
          container: chatContainer,
          input: inputField,
          button: sendButton
        });
        this.chatContainer = chatContainer;
        this.inputField = inputField;
        this.sendButton = sendButton;
        this.startMonitoring();
        obs.disconnect();
      } else {
        console.log("Missing elements:", {
          container: !chatContainer,
          input: !inputField,
          button: !sendButton
        });
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
        const message = node.querySelector('.message.ai .bubble');
        if (message) {
          this.handleAgentMessage(message.textContent);
        }
      }
    });
  }

  handleAgentMessage(text) {
    console.log("Handling agent message: sending agentMessage to chrome runtime", text);
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