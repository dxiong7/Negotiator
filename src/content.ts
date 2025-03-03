// Content script functionality
console.log('Content script initialized');

import { MessageRole } from './types';
import { extractMessageContent } from './utils';

interface Message {
  type: string;
  text: string;
}

class ChatMonitor {
  private messageContainer: HTMLElement | null = null;
  private messageInput: HTMLTextAreaElement | null = null;
  private submitButton: HTMLElement | null = null;
  private monitorInterval: number | null = null;

  constructor() {
    this.setupMonitor();
  }

  private setupMonitor(): void {
    const observer = new MutationObserver((mutations: MutationRecord[], obs: MutationObserver) => {
      const messageContainer = document.querySelector('#message-list') as HTMLElement | null;
      const messageInput = document.querySelector('textarea[name="utterance-input"]') as HTMLTextAreaElement | null;
      const submitButton = document.querySelector('span.send.icon-send-outline[role="button"]') as HTMLElement | null;

      if (messageContainer && messageInput && submitButton) {
        this.messageContainer = messageContainer;
        this.messageInput = messageInput;
        this.submitButton = submitButton;
        obs.disconnect();
        this.startPolling();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private startPolling(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = window.setInterval(() => this.checkForNewMessages(), 5000);
    this.checkForNewMessages(); // Initial check
  }

  private checkForNewMessages(): void {
    if (!this.messageContainer) return;
    const messages = Array.from(this.messageContainer.querySelectorAll('.message'));
    this.processMessages(messages);
  }

  private processMessages(messages: Element[]): void {
    const chatHistory = messages
      .map(messageEl => {
        if (!(messageEl instanceof HTMLElement)) return null;
        const content = extractMessageContent(messageEl);
        if (!content) return null;
        
        return {
          content,
          role: messageEl.classList.contains('ai') ? 'agent' : 'user' as MessageRole,
        };
      })
      .filter((msg): msg is NonNullable<typeof msg> => msg !== null);

    chrome.runtime.sendMessage({
      type: 'updateChatHistory',
      messages: chatHistory
    });
  }

  async insertMessage(text: string): Promise<void> {
    if (this.messageInput && this.submitButton) {
      const event = new InputEvent('input', { bubbles: true });
      this.messageInput.value = text;
      this.messageInput.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 500));
      this.submitButton.click();
    }
  }

  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}

const chatMonitor = new ChatMonitor();

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'sendMessage') {
    chatMonitor.insertMessage(message.text);
  }
});

window.addEventListener('unload', () => {
  chatMonitor.destroy();
}); 