// Basic options functionality
interface StorageData {
  openai_api_key?: string;
}

document.addEventListener('DOMContentLoaded', function() {
    // Load existing API key
    chrome.storage.local.get(['openai_api_key'], function(result: StorageData) {
        const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
    });

    // Save API key
    const saveButton = document.getElementById('save');
    if (saveButton) {
        saveButton.addEventListener('click', function() {
            const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
            const apiKey = apiKeyInput.value;
            
            chrome.storage.local.set({
                'openai_api_key': apiKey
            }, function() {
                const status = document.getElementById('status');
                if (status) {
                    status.textContent = 'Settings saved!';
                    setTimeout(() => {
                        status.textContent = '';
                    }, 2000);
                }
            });
        });
    }
}); 