import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // In a real implementation, this would proxy to the backend
    // For now, we'll return a mock response to indicate the backend is running

    // Check if backend is accessible by making a request to it
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

    // Make a request to the backend health endpoint
    const backendResponse = await fetch(`${backendUrl}/health`);
    const backendData = await backendResponse.json();

    if (backendResponse.ok) {
      res.status(200).json(backendData);
    } else {
      res.status(500).json({ status: 'ERROR', message: 'Backend not responding' });
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'ERROR', message: 'Backend not accessible', error: (error as Error).message });
  }
}