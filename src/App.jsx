import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader } from 'lucide-react';

// --- Gemini API Configuration ---
// Note: API_KEY is left empty, as the Canvas environment automatically provides the key at runtime.
const API_KEY = "AIzaSyASFYyBxVTCXeuIMM6C0Ujve5EUqM8frIs"; 
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

// System Instruction to define the AI's persona
const SYSTEM_INSTRUCTION = "You are 'Uni-Assist', a friendly, knowledgeable, and professional chatbot designed to help university students with academic, administrative, and general campus life problems. Provide concise, encouraging, and helpful responses. Do not use markdown headers (# or ##).";

// Utility for Exponential Backoff (kept for reliable API calls)
const callApiWithBackoff = async (func) => {
    const maxRetries = 5;
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await func();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.warn(`API call failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
};

const App = () => {
    // History is now stored purely in local state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef(null);

    // Scroll to the latest message whenever messages or loading state changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // 1. Gemini API Call
    const getGeminiResponse = async (userText) => {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        // Prepare chat history for context (last 10 messages)
        const historyParts = messages.slice(-10).map(msg => ({ 
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const payload = {
            // Include history plus the new user message
            contents: [...historyParts, { role: 'user', parts: [{ text: userText }] }],
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "I seem to be having trouble understanding that right now. Please try again.";
    };

    // 2. Send Message Handler
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessageText = input.trim();
        setInput('');
        setIsLoading(true);

        // Add user message to local state
        const userMessage = { id: Date.now(), text: userMessageText, role: 'user' };
        setMessages(prev => [...prev, userMessage]);

        try {
            // Get AI response
            const aiResponseText = await callApiWithBackoff(() => getGeminiResponse(userMessageText));

            // Add AI response to local state
            const aiMessage = { id: Date.now() + 1, text: aiResponseText, role: 'model' };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error("Error during chat operation:", error);
            // Add an error message to the chat
            const errorMessage = { id: Date.now() + 1, text: "Sorry, I encountered a technical error while connecting to the AI.", role: 'model' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // UI Component
    const Message = ({ message }) => (
        <div className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3/4 p-3 rounded-xl shadow-lg m-2 flex items-start space-x-2 
                ${message.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                }`}>
                {message.role === 'model' && <Bot className="size-5 shrink-0 mt-0.5 text-indigo-600" />}
                <p className="whitespace-pre-wrap text-sm md:text-base">{message.text}</p>
                {message.role === 'user' && <User className="size-5 shrink-0 mt-0.5 text-blue-100" />}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-gray-50 font-sans">
            {/* Header */}
            <header className="bg-white shadow-lg p-4 flex justify-center items-center z-10">
                <h1 className="text-xl font-bold text-indigo-700 flex items-center">
                    <Bot className="size-6 mr-2" />
                    Uni-Assist Chatbot
                </h1>
            </header>

            {/* Chat Messages Area */}
            <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-10">
                        <Bot className="size-10 text-indigo-400 mb-3" />
                        <h2 className="text-xl font-semibold text-gray-700">Welcome to Uni-Assist!</h2>
                        <p className="text-gray-500 mt-1">Ask me anything about your university life—from essay structure to administrative deadlines.</p>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <Message key={msg.id} message={msg} />
                ))}

                {/* Loading indicator for AI response */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="max-w-3/4 p-3 rounded-xl shadow-lg m-2 flex items-center space-x-2 bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200">
                            <Bot className="size-5 shrink-0 text-indigo-600" />
                            <div className="flex items-center space-x-1">
                                <span className="text-sm">Uni-Assist is typing</span>
                                <Loader className="size-3 animate-spin text-indigo-500" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <div className="fixed bottom-0 inset-x-0 bg-white p-4 border-t border-gray-200 shadow-2xl">
                <form onSubmit={handleSendMessage} className="flex max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Uni-Assist a question..."
                        disabled={isLoading}
                        className="flex-1 p-3 border border-gray-300 rounded-l-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="bg-indigo-600 text-white p-3 rounded-r-xl hover:bg-indigo-700 transition duration-150 flex items-center justify-center disabled:bg-indigo-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
                    >
                        {isLoading ? (
                            <Loader className="size-5 animate-spin" />
                        ) : (
                            <Send className="size-5" />
                        )}
                    </button>
                </form>
            </div>
            

        </div>
    );
};

export default App;