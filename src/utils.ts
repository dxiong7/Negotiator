import { MessageRole, RuntimeMessage } from './types';

export function createMessageId(role: MessageRole, content: string): string {
    return `${role}-${content}`;
}

export function extractMessageContent(element: HTMLElement): string | null {
    const bubble = element.querySelector('.bubble');
    if (!bubble?.textContent) return null;

    return bubble.textContent
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

export function handleError(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

export async function sendRuntimeMessage(message: RuntimeMessage): Promise<void> {
    try {
        await chrome.runtime.sendMessage(message);
    } catch (error) {
        console.error('[Messaging] Failed to send runtime message:', {
            messageType: message.type,
            error: handleError(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        
        if (error instanceof Error && !error.message.includes('receiving end does not exist')) {
            throw error;
        }
    }
} 