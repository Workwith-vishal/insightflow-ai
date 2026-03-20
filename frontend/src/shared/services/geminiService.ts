import axios from 'axios';

class GeminiService {
    constructor() {
        this.queue = []; // Request queue
        this.isProcessingQueue = false; // Flag to keep track of processing
        this.rateLimit = 1000; // 1 second between requests
    }

    async sendRequest(url, options) {
        return axios(url, options);
    }

    enqueueRequest(url, options) {
        return new Promise((resolve, reject) => {
            this.queue.push({ url, options, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.queue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.queue.length > 0) {
            const { url, options, resolve, reject } = this.queue.shift();
            try {
                const response = await this.sendRequest(url, options);
                resolve(response);
            } catch (error) {
                reject(error);
            }
            await this.sleep(this.rateLimit); // Wait for rate limiting
        }
        this.isProcessingQueue = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default new GeminiService();
