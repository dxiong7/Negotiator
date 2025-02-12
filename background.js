class BackgroundManager {
    constructor() {
        this.chatHistory = [];
        this.apiKey = null;
        this.logPrefix = '[BackgroundManager]';
        console.log(`${this.logPrefix} Initialized`);
        this.initializeApiKey();
    }

    async initializeApiKey() {
        try {
            const result = await chrome.storage.local.get(['openai_api_key']);
            this.apiKey = result.openai_api_key;
            console.log(`${this.logPrefix} API Key ${this.apiKey ? 'found' : 'not found'} in storage`);
        } catch (error) {
            console.error(`${this.logPrefix} Error initializing API key:`, error);
            console.log("Fallback to one-time key setting");
            await this.setApiKeyOneTime();
        }
    }

    async handleAgentMessage(message) {
        console.log(`${this.logPrefix} Received agent message:`, message);
        console.log(`${this.logPrefix} Current chat history length:`, this.chatHistory.length);
        
        this.chatHistory.push({ role: 'agent', content: message });
        
        try {
            console.log(`${this.logPrefix} Requesting AI response...`);
            const suggestion = await this.getAIResponse(message);
            console.log(`${this.logPrefix} AI response received:`, suggestion);
            
            chrome.runtime.sendMessage({
                type: 'suggestion',
                text: suggestion
            }).catch(err => {
                console.error(`${this.logPrefix} Error sending suggestion message:`, err);
            });
        } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`${this.logPrefix} Error in handleAgentMessage:`, {
                error: errorMessage,
                stack: error.stack,
                chatHistoryLength: this.chatHistory.length
            });
            
            chrome.runtime.sendMessage({
                type: 'error',
                text: `Error: ${errorMessage}. Please try again or check the API key configuration.`
            }).catch(err => {
                console.error(`${this.logPrefix} Error sending error message:`, err);
            });
            
            this.chatHistory.pop();
        }
    }

    async getAIResponse(agentMessage) {
        if (!this.apiKey) {
            console.error(`${this.logPrefix} API key not found`);
            throw new Error('API key not set. Please configure your OpenAI API key in the extension settings.');
        }
        
        try {
            const requestBody = {
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an AI assistant helping negotiate an Xfinity bill. 
                                Be professional, courteous, but firm in seeking better rates. 
                                Keep responses concise and natural.`
                    },
                    ...this.chatHistory.map(msg => ({
                        role: msg.role === 'agent' ? 'assistant' : 'user',
                        content: msg.content
                    }))
                ],
                temperature: 0.7,
                max_tokens: 150
            };
            
            console.log(`${this.logPrefix} Sending request to OpenAI API...`);
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
                console.error(`${this.logPrefix} API Error Response:`, errorData);
                throw new Error(`API Error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            console.log(`${this.logPrefix} API response received successfully`);
            return data.choices[0].message.content;

        } catch (error) {
            console.error(`${this.logPrefix} Error in getAIResponse:`, {
                error: error.message,
                stack: error.stack,
                endpoint: 'chat/completions',
                messageLength: agentMessage.length
            });
            throw error;
        }
    }

    async setApiKeyOneTime() {
        const key = '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'
        await this.setApiKey(key);
    }

    async setApiKey(key) {
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

// Initialize background manager
const backgroundManager = new BackgroundManager();
console.log('[Extension] Background manager initialized');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Extension] Message received:', message);
    if (message.type === 'agentMessage') {
        // Ensure we're not already processing a message
        if (!backgroundManager.isProcessing) {
            backgroundManager.isProcessing = true;
            backgroundManager.handleAgentMessage(message.text)
                .catch(error => console.error('[Extension] Error handling message:', error))
                .finally(() => {
                    backgroundManager.isProcessing = false;
                });
        } else {
            console.log(`${this.logPrefix} Skipping duplicate message processing`);
        }
    }
    if (message.type === 'getChatHistory') {
        sendResponse({ history: backgroundManager.chatHistory });
    }
    return true; // Important for async response
});