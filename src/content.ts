// Content script functionality
console.log('Content script initialized');

interface Message {
  type: string;
  text: string;
}

class ChatMonitor {
  private chatContainer: HTMLElement | null;
  private inputField: HTMLTextAreaElement | null;
  private sendButton: HTMLElement | null;
  private observer: MutationObserver | null;

  constructor() {
    this.chatContainer = null;
    this.inputField = null;
    this.sendButton = null;
    this.observer = null;
    this.setupMonitor();
  }

  private setupMonitor(): void {
    console.log("Setting up chat monitor");
    const observer = new MutationObserver((mutations: MutationRecord[], obs: MutationObserver) => {
      console.log("Searching for chat elements...");
      
      const chatContainer = document.querySelector('#message-list') as HTMLElement | null;
      const inputField = document.querySelector('textarea[name="utterance-input"]') as HTMLTextAreaElement | null;
      const sendButton = document.querySelector('span.send.icon-send-outline[role="button"]') as HTMLElement | null;

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

  private startMonitoring(): void {
    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          this.checkForNewMessages(mutation.addedNodes);
        }
      }
    });

    if (this.chatContainer) {
      this.observer.observe(this.chatContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  private checkForNewMessages(nodes: NodeList): void {
    nodes.forEach((node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const message = element.querySelector('.message.ai .bubble');
        if (message) {
          this.handleAgentMessage(message.textContent || '');
        }
      }
    });
  }

  private handleAgentMessage(text: string): void {
    console.log("Handling agent message: sending agentMessage to chrome runtime", text);
    chrome.runtime.sendMessage({
      type: 'agentMessage',
      text: text
    });
  }

  async insertMessage(text: string): Promise<void> {
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
chrome.runtime.onMessage.addListener((message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'sendMessage') {
    chatMonitor.insertMessage(message.text);
  }
}); 