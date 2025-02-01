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
}

interface StreamState {
  eventSource: EventSource;
  timeout: NodeJS.Timeout;
  setCurrentStreamId: (id: number | null) => void;
  updateDebates: (updater: (rounds: MessageGroup[]) => MessageGroup[]) => void;
}

export function useStreamHandler() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentRoundRef = useRef<number | null>(null);
  const currentMessageRef = useRef<number | null>(null);
  const messageBufferRef = useRef<string>('');

  const cleanupStream = ({ eventSource, timeout, setCurrentStreamId }: StreamState) => {
    eventSource.close();
    clearTimeout(timeout);
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
      console.log('Handling message complete:', {
        messageId: currentMessageRef.current,
        buffer: messageBufferRef.current
      });

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

  const setupEventHandlers = ({ eventSource, updateDebates, timeout, setCurrentStreamId }: StreamState) => {
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'start_debate':
            messageBufferRef.current = '';
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
            currentRoundRef.current = null;
            messageBufferRef.current = '';
            break;
          case 'debate_complete':
            console.log('Debate complete event received');
            handleDebateComplete(updateDebates);
            cleanupStream({ eventSource, timeout, setCurrentStreamId, updateDebates });
            break;
          case 'error':
            cleanupStream({ eventSource, timeout, setCurrentStreamId, updateDebates });
            break;
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
        cleanupStream({ eventSource, timeout, setCurrentStreamId, updateDebates });
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      cleanupStream({ eventSource, timeout, setCurrentStreamId, updateDebates });
    };
  };

  const startStream = async (
    input: string,
    config: DebateConfig,
    apiKey: string,  // Add API key parameter
    updateDebates: StreamState['updateDebates'],
    setCurrentStreamId: StreamState['setCurrentStreamId']
  ) => {
    try {
      // const response = await fetch('http://localhost:8000/debate/start', {
      const response = await fetch('/api/debate/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey  // Add API key to headers
         },
        body: JSON.stringify({ prompt: input, config })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start stream. Status: ${response.status}. Error: ${errorText}`);
    }

      const { debate_id } = await response.json();

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // const eventSource = new EventSource(`http://localhost:8000/debate/${debate_id}/stream`);
      const eventSource = new EventSource(`/api/debate/${debate_id}/stream`);

      eventSourceRef.current = eventSource;
      const timeout = setTimeout(() => {
        if (eventSourceRef.current) {
          console.log("Timeout hit");
          cleanupStream({ eventSource, timeout, setCurrentStreamId, updateDebates });
        }
      }, 240000);

      setupEventHandlers({ eventSource, timeout, setCurrentStreamId, updateDebates });

    } catch (error) {
      console.error('Error:', error);
      setCurrentStreamId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return { startStream };
}
