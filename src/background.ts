/// <reference lib="dom" />
/// <reference lib="webworker" />

import { ExtensionState, ChatMessage, AIResponse } from './types';
import { handleError, sendRuntimeMessage } from './utils';

export class BackgroundManager {
    public logPrefix: string = '[Background]';
    private chatState: ExtensionState;
    private openAiKey: string | null;
    private isTesting: boolean = false;

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

    getState(): ExtensionState {
        return { ...this.chatState };
    }

    private async initializeApiKey(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['openai_api_key']);
            this.openAiKey = result.openai_api_key;
            if (!this.openAiKey) {
                await this.setApiKeyOneTime();
            }
        } catch (error) {
            console.error(`${this.logPrefix} Error initializing API key:`, error);
            await this.setApiKeyOneTime();
        }
    }

    async updateChatHistory(messages: ChatMessage[]): Promise<void> {
        this.chatState.chatHistory = messages;
        await this.broadcastChatHistoryUpdate();
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
                            Keep responses very concise and natural, the messages should look like they were typed by a human.`
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
        if (!this.openAiKey) throw new Error('API key not set');
        if (this.isTesting) return "This is a test response";
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openAiKey}`
                },
                body: JSON.stringify(this.buildOpenAIRequest())
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json() as AIResponse;
            return data.choices[0].message.content;
        } catch (error) {
            console.error(`${this.logPrefix} Error getting AI response:`, error);
            throw error;
        }
    }

    private async broadcastChatHistoryUpdate(): Promise<void> {
        try {
            await sendRuntimeMessage({
                type: 'chatHistoryUpdated',
                payload: this.chatState.chatHistory
            });
        } catch (error) {
            console.log(`${this.logPrefix} No popup available for chat history update`);
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
        } catch (error) {
            console.error(`${this.logPrefix} Error setting API key:`, error);
            throw error;
        }
    }

    async generateResponse(): Promise<void> {
        try {
            const suggestion = await this.getAIResponse();
            this.chatState.currentSuggestion = suggestion;
            this.chatState.lastError = null;
            await sendRuntimeMessage({ type: 'suggestion', text: suggestion });
        } catch (error) {
            const errorMessage = handleError(error);
            this.chatState.lastError = errorMessage;
            this.chatState.currentSuggestion = null;
            await sendRuntimeMessage({ type: 'error', text: errorMessage });
        }
    }
}

export const backgroundManager = new BackgroundManager();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'updateChatHistory':
            backgroundManager.updateChatHistory(message.messages)
                .catch(error => console.error('[Background] Error updating chat history:', error));
            break;
        case 'getState':
            sendResponse(backgroundManager.getState());
            break;
        case 'generateResponse':
            backgroundManager.generateResponse()
                .catch(error => console.error('[Background] Error generating response:', error));
            break;
    }
    return true;
}); 