// src/lib/realtimeClient.ts
import { io } from 'socket.io-client';

export async function startRealtimeSession() {
  try {
    const res = await fetch('/api/startChat', { method: 'POST' });
    const data = await res.json().catch(async () => {
      const text = await res.text();
      throw new Error(`Server returned non-JSON response: ${text}`);
    });

    if (!res.ok) {
      throw new Error(
        data?.error || `Server returned error: ${JSON.stringify(data)}`
      );
    }

    const { client_secret, url } = data;
    if (!client_secret || !url) {
      throw new Error('Missing client_secret or url in server response');
    }

    // חיבור ל־Realtime API
    const socket = io(url, {
      auth: {
        token: client_secret.value,
      },
    });

    socket.on('connect', () => {
      console.log('Connected to Realtime API');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Realtime API');
    });

    socket.on('error', (err) => {
      console.error('Realtime API error:', err);
      alert(`שגיאה בשיחה: ${err?.message || err}`);
    });

    return socket;
  } catch (error) {
    console.error('Error starting realtime session:', error);
    alert(`שגיאה: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
