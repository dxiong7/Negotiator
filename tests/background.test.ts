import { BackgroundManager } from '../src/background';

describe('BackgroundManager', () => {
    let manager: BackgroundManager;
    
    beforeEach(() => {
        // Mock chrome.storage.local with Promise-based methods
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({ openai_api_key: 'test-key' }),
                    set: jest.fn().mockResolvedValue(undefined)
                }
            },
            runtime: {
                sendMessage: jest.fn().mockResolvedValue(undefined)
            }
        } as unknown as typeof chrome;
        
        manager = new BackgroundManager();
    });

    test('handleAgentMessage processes messages correctly', async () => {
        // Mock the API response
        global.fetch = jest.fn(() => 
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: 'Test AI response'
                        }
                    }]
                })
            })
        ) as jest.Mock;

        await manager.handleAgentMessage('Test message');
        
        expect(manager['chatHistory'].length).toBe(1);
        expect(global.fetch).toHaveBeenCalled();
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
            type: 'suggestion',
            text: 'Test AI response'
        });
    });
}); 