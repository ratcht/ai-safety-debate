import { useRef, useEffect } from 'react';
import type { DebateConfig } from '@/types/types';

interface Message {
  id: number;
  response: string;
  isComplete: boolean;
}

interface MessageGroup {
  id: number;
  messages: Message[];
  debateId?: number;
}

interface StreamState {
  setCurrentStreamId: (id: number | null) => void;
  updateDebates: (updater: (rounds: MessageGroup[]) => MessageGroup[]) => void;
}

export function useStreamHandler() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRoundRef = useRef<number | null>(null);
  const currentMessageRef = useRef<number | null>(null);
  const messageBufferRef = useRef<string>('');

  const cleanupStream = ({ setCurrentStreamId }: StreamState) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCurrentStreamId(null);
  };

  const handleMessageStart = (updateDebates: StreamState['updateDebates']) => {
    currentMessageRef.current = Date.now();
    messageBufferRef.current = '';
    updateDebates(prev => {
      const lastRound = prev[prev.length - 1];
      if (!lastRound) return prev;

      return prev.map(round =>
        round.id === lastRound.id
          ? {
              ...round,
              messages: [
                ...round.messages,
                { id: currentMessageRef.current!, response: '', isComplete: false }
              ]
            }
          : round
      );
    });
  };

  const handleToken = (updateDebates: StreamState['updateDebates'], message: string) => {
    if (currentMessageRef.current) {
      messageBufferRef.current += message;
      updateDebates(prev => {
        const lastRound = prev[prev.length - 1];
        if (!lastRound) return prev;

        return prev.map(round =>
          round.id === lastRound.id
            ? {
                ...round,
                messages: round.messages.map(msg =>
                  msg.id === currentMessageRef.current
                    ? { ...msg, response: messageBufferRef.current }
                    : msg
                )
              }
            : round
        );
      });
    }
  };

  const handleMessageComplete = (updateDebates: StreamState['updateDebates']) => {
    if (currentMessageRef.current) {
      messageBufferRef.current = '';
      updateDebates(prev => {
        const lastRound = prev[prev.length - 1];
        if (!lastRound) return prev;

        return prev.map(round =>
          round.id === lastRound.id
            ? {
                ...round,
                messages: round.messages.map(msg =>
                  msg.id === currentMessageRef.current
                    ? { ...msg, isComplete: true }
                    : msg
                )
              }
            : round
        );
      });
      currentMessageRef.current = null;
    }
  };

  const handleRoundStart = (updateDebates: StreamState['updateDebates']) => {
    currentRoundRef.current = Date.now();
    messageBufferRef.current = '';
    updateDebates(prev => [
      ...prev,
      { id: currentRoundRef.current!, messages: [] }
    ]);
  };

  const handleDebateComplete = (updateDebates: StreamState['updateDebates']) => {
    updateDebates(prev => {
      const lastRound = prev[prev.length - 1];
      if (!lastRound) return prev;

      return prev.map(round =>
        round.id === lastRound.id ? { ...round, isComplete: true } : round
      );
    });
  };

  const startStream = async (
    input: string,
    config: DebateConfig,
    apiKey: string,
    updateDebates: StreamState['updateDebates'],
    setCurrentStreamId: StreamState['setCurrentStreamId']
  ) => {
    try {
      const response = await fetch('/api/debate/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({ prompt: input, config })
      });
  
      if (!response.ok) {
        throw new Error(`Failed to start stream. Status: ${response.status}`);
      }
  
      const { debate_id } = await response.json();
  
      // Create new AbortController for this stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
  
      const streamResponse = await fetch(`/api/debate/${debate_id}/stream`, {
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        signal: abortControllerRef.current.signal
      });
  
      if (!streamResponse.ok) throw new Error('Stream response not ok');
      if (!streamResponse.body) throw new Error('No response body');
  
      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
  
      let buffer = '';
      const processBuffer = (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
  
        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (!match) continue;
  
          try {
            const data = JSON.parse(match[1]);
            console.log('Processed data:', data);
            
            switch (data.type) {
              case 'start_debate':
                break;
              case 'round_start':
                handleRoundStart(updateDebates);
                break;
              case 'message_start':
                handleMessageStart(updateDebates);
                break;
              case 'token':
                handleToken(updateDebates, data.message);
                break;
              case 'token_end':
                handleToken(updateDebates, '');
                break;
              case 'message_complete':
                handleMessageComplete(updateDebates);
                break;
              case 'round_complete':
                break;
              case 'debate_complete':
                handleDebateComplete(updateDebates);
                cleanupStream({ setCurrentStreamId, updateDebates });
                return true;
              case 'error':
                console.error('Stream error:', data.message);
                return true;
            }
          } catch (e) {
            console.error('Failed to parse line:', line, e);
          }
        }
        return false;
      };
  
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
  
          const chunk = decoder.decode(value, { stream: true });
          const shouldStop = processBuffer(chunk);
          if (shouldStop) break;
        }
      } finally {
        reader.releaseLock();
      }
  
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Stream error:', error);
      }
      setCurrentStreamId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { startStream };
}