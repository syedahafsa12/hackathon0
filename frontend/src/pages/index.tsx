import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [status, setStatus] = useState('checking');
  const [apiData, setApiData] = useState(null);

  useEffect(() => {
    // Check if the backend API is running
    fetch('/api/health')  // Changed to relative path to avoid CORS issues
      .then(response => response.json())
      .then(data => {
        setStatus('connected');
        setApiData(data);
      })
      .catch(error => {
        console.error('API connection failed:', error);
        setStatus('disconnected');
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Head>
        <title>Mini Hafsa - Personal AI Employee</title>
        <meta name="description" content="Your personal AI assistant" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600 mb-6">
            Mini Hafsa
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            Your personal AI employee, ready to assist with daily tasks, emails, calendar, and more.
          </p>

          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-lg mb-8 border border-pink-100">
            <div className="flex items-center justify-center mb-4">
              <div className={`w-3 h-3 rounded-full mr-2 ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium">
                Backend Status: <span className={status === 'connected' ? 'text-green-600' : 'text-red-600'}>
                  {status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </span>
            </div>

            {apiData && (
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg inline-block">
                {JSON.stringify(apiData)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md border border-pink-100">
              <h3 className="font-bold text-pink-600 mb-2">Chat Interface</h3>
              <p className="text-gray-600 text-sm">Control everything through a ChatGPT-style interface</p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md border border-pink-100">
              <h3 className="font-bold text-purple-600 mb-2">Smart Automation</h3>
              <p className="text-gray-600 text-sm">Handles emails, calendar, tasks, and more</p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md border border-pink-100">
              <h3 className="font-bold text-indigo-600 mb-2">Human Approval</h3>
              <p className="text-gray-600 text-sm">All sensitive actions require your explicit approval</p>
            </div>
          </div>

          <div className="space-y-4">
            <Link href="/dashboard" className="inline-block bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-4 px-8 rounded-full text-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
              Open Dashboard
            </Link>

            <div className="pt-4 flex justify-center gap-6">
              <Link href="/control" className="text-purple-600 hover:text-purple-800 underline">
                Control Panel
              </Link>
              <Link href="/vault" className="text-pink-600 hover:text-pink-800 underline">
                Vault Browser
              </Link>
              <Link href="/chat" className="text-pink-600 hover:text-pink-800 underline">
                Simple Chat
              </Link>
            </div>

            <div className="pt-6">
              <p className="text-gray-500">
                Connect your email, calendar, and other services to get started
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-6 text-gray-500 text-sm">
        <p>Mini Hafsa - Your Personal AI Employee © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}