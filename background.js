class BackgroundManager {
  constructor() {
    this.chatHistory = [];
    this.OPENAI_API_KEY = 'your-api-key-here'; // Store securely
  }

  async handleAgentMessage(message) {
    this.chatHistory.push({ role: 'agent', content: message });
    
    // Generate AI response
    const suggestion = await this.getAIResponse(message);
    
    // Send suggestion to popup
    chrome.runtime.sendMessage({
      type: 'suggestion',
      text: suggestion
    });
  }

  async getAIResponse(agentMessage) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4",
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
            })),
            {
              role: "user",
              content: `Agent said: ${agentMessage}\nGenerate a response that negotiates for a better rate.`
            }
          ]
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'I apologize, but I am unable to generate a response at this time.';
    }
  }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'agentMessage') {
    backgroundManager.handleAgentMessage(message.text);
  }
});