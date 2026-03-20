// apiKeyValidation.ts

// Function to validate the format of the API key
function validateApiKeyFormat(apiKey: string): boolean {
    const apiKeyRegex = /^[A-Za-z0-9]{32}$/; // Example pattern for a 32 character alphanumeric key
    return apiKeyRegex.test(apiKey);
}

// Function to test API key validity with the Gemini API
async function testApiKeyValidity(apiKey: string): Promise<boolean> {
    try {
        const response = await fetch('https://api.gemini.com/v1/apiKeyValidation', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Error validating API key:', error);
        return false;
    }
}

// Function to provide validation error messages
function getValidationErrorMessage(apiKey: string): string {
    if (!validateApiKeyFormat(apiKey)) {
        return 'Invalid API key format. The API key must be 32 alphanumeric characters.';
    }
    return 'API key is valid.';
}

export { validateApiKeyFormat, testApiKeyValidity, getValidationErrorMessage };