// TypeScript types for Gemini API integration

type GeminiOrder = {
    id: string;
    symbol: string;
    quantity: number;
    price: number;
    side: 'buy' | 'sell';
    status: 'open' | 'closed' | 'pending';
    createdAt: string; // ISO 8601 date string
};


type GeminiAccount = {
    accountId: string;
    balance: number;
    currency: string;
    lastUpdated: string; // ISO 8601 date string
};


type GeminiTrade = {
    tradeId: string;
    orderId: string;
    quantity: number;
    price: number;
    timestamp: string; // ISO 8601 date string
};