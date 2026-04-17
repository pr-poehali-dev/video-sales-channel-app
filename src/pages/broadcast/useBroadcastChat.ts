import { useState, useRef, useEffect, useCallback } from "react";
import type { MutableRefObject } from "react";
import { useStore, type ChatMessage } from "@/context/StoreContext";

interface UseBroadcastChatOptions {
  isLive: boolean;
  streamIdRef: MutableRefObject<string | null>;
  userId: string;
  userName: string;
  userAvatar: string;
}

export function useBroadcastChat({ isLive, streamIdRef, userId, userName, userAvatar }: UseBroadcastChatOptions) {
  const { addChatMessage, getStreamMessages } = useStore();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput,    setChatInput]    = useState("");
  const [chatVisible,  setChatVisible]  = useState(true);
  const [chatSending,  setChatSending]  = useState(false);

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshChat = useCallback(async () => {
    if (!streamIdRef.current) return;
    try { setChatMessages(await getStreamMessages(streamIdRef.current)); } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLive) {
      refreshChat();
      chatPollRef.current = setInterval(refreshChat, 3000);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [isLive, refreshChat]);

  useEffect(() => {
    if (chatVisible) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, chatVisible]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatSending || !streamIdRef.current) return;
    setChatSending(true);
    try {
      const msg = await addChatMessage({
        streamId: streamIdRef.current,
        userId,
        userName: userName.split(" ")[0],
        userAvatar,
        text: chatInput.trim(),
      });
      setChatMessages(prev => [...prev, msg]);
      setChatInput("");
    } catch { /* ignore */ }
    finally { setChatSending(false); }
  };

  const resetChat = () => {
    setChatMessages([]);
    setChatInput("");
  };

  return {
    chatMessages,
    chatInput, setChatInput,
    chatVisible, setChatVisible,
    chatSending,
    chatEndRef,
    chatPollRef,
    sendChat,
    resetChat,
  };
}
