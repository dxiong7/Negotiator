document.addEventListener('DOMContentLoaded', function() {
    // Load existing API key
    chrome.storage.local.get(['openai_api_key'], function(result) {
        if (result.openai_api_key) {
            document.getElementById('apiKey').value = result.openai_api_key;
        }
    });

    // Save API key
    document.getElementById('save').addEventListener('click', function() {
        const apiKey = document.getElementById('apiKey').value;
        chrome.storage.local.set({
            'openai_api_key': apiKey
        }, function() {
            const status = document.getElementById('status');
            status.textContent = 'Settings saved!';
            setTimeout(() => {
                status.textContent = '';
            }, 2000);
        });
    });
}); 