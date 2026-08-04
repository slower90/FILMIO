import { Navbar } from "@/components/navbar";
import { useListConversations, useListMessages, useSendMessage } from "@workspace/api-client-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";

export default function Chat() {
  const { user } = useUser();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  
  const { data: conversations, isLoading: loadingConvs } = useListConversations();
  const { data: messages, isLoading: loadingMessages } = useListMessages(
    activeConvId || 0, 
    { query: { enabled: !!activeConvId, refetchInterval: 3000 } } // simple polling
  );
  
  const sendMessage = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConvId) {
      // Check URL for ?conv=123
      const urlParams = new URLSearchParams(window.location.search);
      const convParam = urlParams.get('conv');
      if (convParam) {
        setActiveConvId(parseInt(convParam, 10));
      } else {
        setActiveConvId(conversations[0].id);
      }
    }
  }, [conversations, activeConvId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeConvId) return;
    
    sendMessage.mutate(
      { params: { id: activeConvId }, data: { content: message } },
      { 
        onSuccess: () => {
          setMessage("");
          // Note: In a real app we'd optimistic update the cache, but polling catches it quickly
        }
      }
    );
  };

  const activeConv = conversations?.find(c => c.id === activeConvId);
  // Find the "other" participant
  const otherUser = activeConv?.participants?.find(p => p.userId !== user?.id) || activeConv?.participants?.[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 pt-24 pb-8 flex h-[calc(100vh-2rem)]">
        <div className="w-full bg-card border border-border rounded-lg overflow-hidden flex shadow-2xl">
          
          {/* Sidebar */}
          <div className="w-full md:w-80 border-r border-border flex flex-col bg-background/50">
            <div className="p-4 border-b border-border bg-card">
              <h2 className="font-display font-bold uppercase tracking-wider text-lg">Messages</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
                </div>
              ) : conversations && conversations.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {conversations.map(conv => {
                    const other = conv.participants?.find(p => p.userId !== user?.id) || conv.participants?.[0];
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setActiveConvId(conv.id)}
                        className={cn(
                          "w-full text-left p-4 hover:bg-secondary/50 transition-colors flex gap-3",
                          activeConvId === conv.id ? "bg-secondary" : ""
                        )}
                      >
                        <img 
                          src={other?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${other?.displayName || 'User'}`} 
                          alt="Avatar" 
                          className="w-10 h-10 rounded-full object-cover shrink-0 bg-muted"
                        />
                        <div className="overflow-hidden">
                          <p className="font-bold text-sm truncate">{other?.displayName || "Unknown User"}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage || "No messages yet"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Chat Area */}
          <div className="hidden md:flex flex-1 flex-col bg-background relative">
            {activeConvId && otherUser ? (
              <>
                <div className="p-4 border-b border-border bg-card flex items-center gap-3">
                  <img 
                    src={otherUser.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${otherUser.displayName || 'User'}`} 
                    alt="Avatar" 
                    className="w-10 h-10 rounded-full object-cover shrink-0 bg-muted"
                  />
                  <div>
                    <h2 className="font-bold">{otherUser.displayName || "Unknown User"}</h2>
                    {otherUser.isProfessional && <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Professional</span>}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                  ) : messages && messages.length > 0 ? (
                    messages.map(msg => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <div key={msg.id} className={cn("flex max-w-[80%]", isMe ? "ml-auto justify-end" : "")}>
                          <div className={cn(
                            "p-3 rounded-lg text-sm",
                            isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-secondary-foreground rounded-bl-none"
                          )}>
                            <p>{msg.content}</p>
                            <p className={cn("text-[10px] mt-1 opacity-70", isMe ? "text-right" : "text-left")}>
                              {format(new Date(msg.createdAt), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Say hello!
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <div className="p-4 border-t border-border bg-card">
                  <form onSubmit={handleSend} className="flex gap-2">
                    <Input 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..." 
                      className="bg-background border-border"
                      disabled={sendMessage.isPending}
                    />
                    <Button type="submit" size="icon" disabled={!message.trim() || sendMessage.isPending}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="w-16 h-16 opacity-20 mb-4" />
                <p className="font-display uppercase tracking-widest text-lg">Select a conversation</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
