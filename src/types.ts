export type MessagePosition = 'before' | 'after' | 'new';
export type MessageRole = 'agent' | 'user';
export type MessageType = 
    | 'suggestion' 
    | 'error' 
    | 'chatMessage' 
    | 'getChatHistory' 
    | 'getState'
    | 'generateResponse'
    | 'chatHistoryUpdated';

export interface ChatMessage {
    role: MessageRole;
    content: string;
}

export interface RuntimeMessage {
    type: MessageType;
    text?: string;
    payload?: unknown;
    role?: MessageRole;
    position?: MessagePosition;
}

export interface NegotiationContext {
    currentServices?: string;
    desiredServices?: string;
    competitorOffers?: string;
    serviceIssues?: string;
    otherContext?: string;
}

export interface ExtensionState {
    currentSuggestion: string | null;
    lastError: string | null;
    chatHistory: ChatMessage[];
    zipCode: string | null;
    negotiationContext: NegotiationContext;
}

export interface AIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
} 