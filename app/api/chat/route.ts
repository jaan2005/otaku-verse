import { NextResponse } from 'next/server';

// This runs on the SERVER. Users cannot see this code or your Key.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    // Get the key from the server environment variables
    // IMPORTANT: In Vercel Settings, name the variable 'GROQ_API_KEY' (no NEXT_PUBLIC_)
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured on server' }, { status: 500 });
    }

    // Call Groq from the server
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}` // The key is used here, hidden from the user
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.9,
        max_tokens: 250
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Groq Error' }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}