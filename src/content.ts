// Content script functionality
console.log('Content script initialized');

import { MessageRole, MessagePosition, RuntimeMessage } from './types';
import { createMessageId, extractMessageContent } from './utils';

interface Message {
  type: string;
  text: string;
  role?: string;
}

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
}

class ChatMonitor {
  private messageContainer: HTMLElement | null = null;
  private messageInput: HTMLTextAreaElement | null = null;
  private submitButton: HTMLElement | null = null;
  private processedMessages: Set<string> = new Set();
  private earliestMessageId: string | null = null;
  private monitorInterval: number | null = null;
  private lastKnownMessageCount: number = 0;  // Track message count

  constructor() {
    this.setupMonitor();
  }

  private setupMonitor(): void {
    console.log("Setting up chat monitor");
    const observer = new MutationObserver((mutations: MutationRecord[], obs: MutationObserver) => {
      const messageContainer = document.querySelector('#message-list') as HTMLElement | null;
      const messageInput = document.querySelector('textarea[name="utterance-input"]') as HTMLTextAreaElement | null;
      const submitButton = document.querySelector('span.send.icon-send-outline[role="button"]') as HTMLElement | null;

      if (messageContainer && messageInput && submitButton) {
        console.log("Chat elements found");
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

    this.monitorInterval = window.setInterval(() => {
      this.checkForNewMessages();
    }, 5000);

    // Do an initial check immediately
    this.checkForNewMessages();
  }

  private checkForNewMessages(): void {
    console.log("Checking for new messages...");
    if (!this.messageContainer) return;

    const currMessageElements = Array.from(this.messageContainer.querySelectorAll('.message'));
    
    chrome.runtime.sendMessage({ type: 'getMessageCount' }, (response) => {
        this.processNewMessages(currMessageElements, response.count);
    });
  }

  private processNewMessages(messages: Element[], processedCount: number): void {
    const currentCount = messages.length;
    
    if (currentCount <= processedCount) {
        console.log('No new messages to process; skipping polling');
        return;
    }

    console.log(`Found ${currentCount - processedCount} new messages to process`);
    
    messages.forEach(messageEl => {
        if (messageEl instanceof HTMLElement) {
            this.processMessage(messageEl, messages);
        }
    });
    
    this.lastKnownMessageCount = currentCount;
  }

  private processMessage(messageEl: HTMLElement, allMessages: Element[]): void {
    const content = extractMessageContent(messageEl);
    if (!content) return;

    const role: MessageRole = messageEl.classList.contains('ai') ? 'agent' : 'user';
    const messageId = createMessageId(role, content);
    
    if (this.processedMessages.has(messageId)) return;
    
    const position = this.determineMessagePosition(messageEl, allMessages);
    this.updateMessageTracking(position, messageId);
    this.notifyBackground(content, role, position); // send message to background script
  }

  private notifyBackground(content: string, role: MessageRole, position: MessagePosition): void {
    chrome.runtime.sendMessage({
      type: 'chatMessage',
      text: content,
      role,
      position
    });
  }

  private determineMessagePosition(messageEl: HTMLElement, allMessages: Element[]): MessagePosition {
    if (!this.earliestMessageId) {
        // First time processing any message
        return 'new';
    }

    // Get index of current message in the array of all visible messages
    const currentIndex = allMessages.indexOf(messageEl);
    
    // Find index of our first processed message in the same array
    const firstIndex = allMessages.findIndex(el => 
      createMessageId(
            el.classList.contains('ai') ? 'agent' : 'user',
            el.querySelector('.bubble')?.textContent?.trim() || ''
        ) === this.earliestMessageId
    );

    // Both indices are from the same array, so we can compare them
    // If currentIndex < firstIndex, this message appears earlier in the chat
    if (currentIndex < firstIndex) {
        return 'before';
    }

    return 'new';
  }

  private updateMessageTracking(position: MessagePosition, messageId: string): void {
    this.processedMessages.add(messageId);

    if (position === 'before') {
        this.earliestMessageId = messageId;
    }
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

  // Cleanup method to clear interval when needed
  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}

// Initialize chat monitor
const chatMonitor = new ChatMonitor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'sendMessage') {
    chatMonitor.insertMessage(message.text);
  }
});

// Cleanup when the content script is unloaded
window.addEventListener('unload', () => {
  chatMonitor.destroy();
}); 