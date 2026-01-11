import { NextResponse } from 'next/server';

// This function handles the POST request from your frontend
export async function POST(req: Request) {
  try {
    // 1. Get the message data sent from the frontend
    const body = await req.json();

    // 2. Retrieve your secret key from the server environment
    const apiKey = process.env.GROQ_API_KEY;

    // Safety check: Ensure the key exists
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Groq API Key not configured on server' },
        { status: 500 }
      );
    }

    // 3. Forward the request to Groq from the server (Secure!)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`, // Key is used here, hidden from user
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Handle errors from Groq
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Error fetching from Groq' },
        { status: response.status }
      );
    }

    // 4. Return the AI's response back to the frontend
    return NextResponse.json(data);

  } catch (error) {
    console.error('Groq Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}