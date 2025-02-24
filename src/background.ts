//import { sendRuntimeMessage } from './utils/messaging';

type MessageType = 'suggestion' | 'error' | 'agentMessage' | 'getChatHistory';

interface RuntimeMessage {
    type: MessageType;
    text?: string;
    payload?: unknown;
}

async function sendRuntimeMessage(message: RuntimeMessage): Promise<void> {
    try {
        await chrome.runtime.sendMessage(message);
    } catch (error) {
        console.error('[Messaging] Failed to send runtime message:', {
            messageType: message.type,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        
        if (error instanceof Error && !error.message.includes('receiving end does not exist')) {
            throw error;
        }
    }
}

interface ChatMessage {
    role: 'agent' | 'user';
    content: string;
}

interface AIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export class BackgroundManager {
    public isProcessing: boolean = false;
    public logPrefix: string = '[Background]';
    public chatHistory: any[] = [];
    private apiKey: string | null;
    private isTesting: boolean = true;

    constructor() {
        this.apiKey = null;
        console.log(`${this.logPrefix} Initialized`);
        this.initializeApiKey();
    }

    private async initializeApiKey(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['openai_api_key']);
            this.apiKey = result.openai_api_key;
            console.log(`${this.logPrefix} API Key ${this.apiKey ? 'found' : 'not found'} in storage`);
            if (!this.apiKey) {
                console.log("Fallback to one-time key setting");
                await this.setApiKeyOneTime();
            }
        } catch (error) {
            console.error(`${this.logPrefix} Error initializing API key:`, error);
            console.log("Fallback to one-time key setting");
            await this.setApiKeyOneTime();
        }
    }

    async handleAgentMessage(message: string): Promise<void> {
        console.log(`${this.logPrefix} Received new agent message:`, message);
        console.log(`${this.logPrefix} Chat history length:`, this.chatHistory.length);
        
        this.chatHistory.push({ role: 'agent', content: message });
        
        try {
            console.log(`${this.logPrefix} Requesting AI response...`);
            const suggestion = await this.getAIResponse();
            console.log(`${this.logPrefix} AI response received:`, suggestion);
            
            await sendRuntimeMessage({
                type: 'suggestion',
                text: suggestion
            });
        } catch (error) {
            console.error(`${this.logPrefix} Failed to get AI response`);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`${this.logPrefix} Error in handleAgentMessage:`, {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                chatHistoryLength: this.chatHistory.length
            });
            
            await sendRuntimeMessage({
                type: 'error',
                text: `Error: ${errorMessage}. Please try again or check the API key configuration.`
            });
            
            this.chatHistory.pop();
        }
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
                    content: `You are an assistant helping negotiate an Xfinity internet/cable bill through a chat with a virtual agent. 
                            Your goal is to come up with messages and to be professional, courteous, but firm in seeking better rates. 
                            Keep responses concise and natural. You will be given the chat history and you need to come up with an appropriate message to send to the agent.`
                },
                ...this.chatHistory.map(msg => ({
                    role: msg.role === 'agent' ? 'assistant' : 'user',
                    content: msg.content
                }))
            ],
            temperature: 0.7,
            max_tokens: 150
        };
    }

    private async getAIResponse(): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not set. Please configure your OpenAI API key in the extension settings.');
        }
        
        try {
            const requestBody = this.buildOpenAIRequest();

            if (this.isTesting) {
                console.log(`${this.logPrefix} Testing mode enabled. Returning test response.`);
                console.log(`${this.logPrefix} Request body:`, requestBody);
                return "This is a test response";
            }
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json() as AIResponse;
            console.log(`${this.logPrefix} LLM api response:`, data.toString());
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
            this.apiKey = key;
            console.log(`${this.logPrefix} API key updated successfully`);
        } catch (error) {
            console.error(`${this.logPrefix} Error setting API key:`, error);
            throw error;
        }
    }
}

// Export a single instance instead of using exports.BackgroundManager
export const backgroundManager = new BackgroundManager();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Extension] Message received:', message);
    if (message.type === 'agentMessage') {
        // Ensure we're not already processing a message
        if (!backgroundManager.isProcessing) {
            backgroundManager.isProcessing = true;
            backgroundManager.handleAgentMessage(message.text)
                .catch((error: Error) => console.error('[Extension] Error handling message:', error))
                .finally(() => {
                    backgroundManager.isProcessing = false;
                });
        } else {
            console.log(`${backgroundManager.logPrefix} Skipping duplicate message processing`);
        }
    }
    if (message.type === 'GET_HISTORY') {
        sendResponse({ history: backgroundManager.chatHistory });
        return true; // Important for async response
    }
    return true; // Important for async response
}); 