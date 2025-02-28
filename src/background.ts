/// <reference lib="dom" />
/// <reference lib="webworker" />

import { ExtensionState, ChatMessage, AIResponse } from './types';
import { createMessageId, handleError, sendRuntimeMessage } from './utils';

export class BackgroundManager {
    public logPrefix: string = '[Background]';
    private chatState: ExtensionState;
    private openAiKey: string | null;
    private isTesting: boolean = false;
    private processedMessageIds: Set<string> = new Set();
    private earliestMessageId: string | null = null;
    private latestMessageId: string | null = null;

    constructor() {
        this.openAiKey = null;
        this.chatState = {
            currentSuggestion: null,
            lastError: null,
            chatHistory: []
        };
        console.log(`${this.logPrefix} Initialized`);
        this.initializeApiKey();
    }

    // Getter methods for popup to access state
    getState(): ExtensionState {
        return { ...this.chatState }; // Return copy to prevent direct mutation
    }

    private async initializeApiKey(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['openai_api_key']);
            this.openAiKey = result.openai_api_key;
            console.log(`${this.logPrefix} API Key ${this.openAiKey ? 'found' : 'not found'} in storage`);
            if (!this.openAiKey) {
                console.log("Fallback to one-time key setting");
                await this.setApiKeyOneTime();
            }
        } catch (error) {
            console.error(`${this.logPrefix} Error initializing API key:`, error);
            console.log("Fallback to one-time key setting");
            await this.setApiKeyOneTime();
        }
    }

    async handleChatMessage(text: string, role: 'agent' | 'user', position: 'before' | 'after' | 'new'): Promise<void> {
        const messageId = createMessageId(role, text);
        
        if (this.isDuplicateMessage(messageId)) return;
        
        this.processMessage(messageId, role, text, position);
        
        if (this.shouldGenerateResponse(role)) {
            await this.generateAndSendAiResponse();
        }
    }

    private isDuplicateMessage(messageId: string): boolean {
        if (this.processedMessageIds.has(messageId)) {
            console.log(`${this.logPrefix} Skipping duplicate message`);
            return true;
        }
        return false;
    }

    private processMessage(messageId: string, role: 'agent' | 'user', text: string, position: 'before' | 'after' | 'new'): void {
        this.processedMessageIds.add(messageId);
        const newMessage = { role, content: text };

        this.updateMessageTracking(messageId, position);
        this.insertMessageInHistory(newMessage, position);
        
        // Broadcast chat history update to popup
        this.broadcastChatHistoryUpdate();
    }

    private updateMessageTracking(messageId: string, position: 'before' | 'after' | 'new'): void {
        if (!this.earliestMessageId) {
            this.earliestMessageId = messageId;
            this.latestMessageId = messageId;
            return;
        }

        if (position === 'before') {
            this.earliestMessageId = messageId;
        } else {
            this.latestMessageId = messageId;
        }
    }

    private insertMessageInHistory(message: ChatMessage, position: 'before' | 'after' | 'new'): void {
        if (position === 'before') {
            this.chatState.chatHistory.unshift(message);
        } else {
            this.chatState.chatHistory.push(message);
        }
    }

    resetState(): void {
        this.chatState.chatHistory = [];
        this.chatState.currentSuggestion = null;
        this.chatState.lastError = null;
        this.processedMessageIds.clear();
        this.earliestMessageId = null;
        this.latestMessageId = null;
        console.log(`${this.logPrefix} State reset`);
    }

    private buildOpenAIRequest(): {
        model: string;
        messages: Array<{role: string; content: string}>;
        temperature: number;
        max_tokens: number;
    } {
        return {
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert negotiator skilled in negotiation tactics and trying to negotiate an Xfinity internet/cable services through a chat with a virtual agent. 
                            Your ultimate goal is to save money on your bill through better rates for existing services. Your messages should be direct and above all firm in seeking better rates. 
                            Keep responses very concise and natural, the messages should look like they were typed by a human. You will be given the chat history and you need to come up with an appropriate message to send to the agent.`
                },
                ...this.chatState.chatHistory.map(msg => ({
                    role: msg.role === 'agent' ? 'user' : 'assistant',
                    content: msg.content
                }))
            ],
            temperature: 0.7,
            max_tokens: 150
        };
    }

    private async getAIResponse(): Promise<string> {
        if (!this.openAiKey) {
            throw new Error('API key not set. Please configure your OpenAI API key in the extension settings.');
        }
        
        try {
            const requestBody = this.buildOpenAIRequest();
            console.log(`${this.logPrefix} Request body:`, requestBody);
            if (this.isTesting) {
                console.log(`${this.logPrefix} Testing mode enabled. Returning test response.`);
                return "This is a test response";
            }
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openAiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json() as AIResponse;
            console.log(`${this.logPrefix} LLM api response:`, response);
            return data.choices[0].message.content;

        } catch (error) {
            console.error(`${this.logPrefix} Error getting AI response:`, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    private async setApiKeyOneTime(): Promise<void> {
        const key = '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';
        await this.setApiKey(key);
    }

    async setApiKey(key: string): Promise<void> {
        try {
            await chrome.storage.local.set({ 'openai_api_key': key });
            this.openAiKey = key;
            console.log(`${this.logPrefix} API key updated successfully`);
        } catch (error) {
            console.error(`${this.logPrefix} Error setting API key:`, error);
            throw error;
        }
    }

    private shouldGenerateResponse(role: 'agent' | 'user'): boolean {
        return false; // No longer auto-generate responses
    }

    private async generateAndSendAiResponse(): Promise<void> {
        try {
            const suggestion = await this.getAIResponse();
            this.updateStateWithSuggestion(suggestion);
            await this.notifyPopup('suggestion', suggestion);
        } catch (error) {
            const errorMessage = handleError(error);
            this.updateStateWithError(errorMessage);
            await this.notifyPopup('error', errorMessage);
        }
    }

    private async notifyPopup(type: 'suggestion' | 'error', text: string): Promise<void> {
        try {
            await sendRuntimeMessage({ type, text });
        } catch (error) {
            console.log(`${this.logPrefix} Popup not available, ${type} stored in state`);
        }
    }

    private updateStateWithSuggestion(suggestion: string): void {
        this.chatState.currentSuggestion = suggestion;
        this.chatState.lastError = null;
    }

    private updateStateWithError(error: string): void {
        this.chatState.lastError = error;
        this.chatState.currentSuggestion = null;
    }

    getMessageCount(): number {
        return this.chatState.chatHistory.length;
    }

    // Add a new method to handle generate request from popup
    async generateResponse(): Promise<void> {
        try {
            const suggestion = await this.getAIResponse();
            this.updateStateWithSuggestion(suggestion);
            await this.notifyPopup('suggestion', suggestion);
        } catch (error) {
            const errorMessage = handleError(error);
            this.updateStateWithError(errorMessage);
            await this.notifyPopup('error', errorMessage);
        }
    }

    private async broadcastChatHistoryUpdate(): Promise<void> {
        try {
            console.log(`${this.logPrefix} Detected chat history update; Broadcasting chat history update`);
            await sendRuntimeMessage({
                type: 'chatHistoryUpdated',
                payload: this.chatState.chatHistory
            });
        } catch (error) {
            console.log(`${this.logPrefix} No popup available for chat history update`);
        }
    }
}

export const backgroundManager = new BackgroundManager();

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    //console.log('[Extension] Message received:', message);
    
    switch (message.type) {
        case 'getMessageCount':
            sendResponse({ count: backgroundManager.getMessageCount() });
            break;
            
        case 'chatMessage':
            backgroundManager.handleChatMessage(message.text, message.role, message.position)
                .catch((error: Error) => console.error('[Background] Error handling chat message:', error));
            break;
            
        case 'getState':
            const state = backgroundManager.getState();
            console.log(`${backgroundManager.logPrefix} Sending state to popup:`, state);
            sendResponse(state);
            break;
            
        case 'generateResponse':
            backgroundManager.generateResponse()
                .catch((error: Error) => console.error('[Background] Error generating response:', error));
            break;
            
        default:
            console.error(`${backgroundManager.logPrefix} Unknown message type:`, message.type);
    }
    return true;
}); 