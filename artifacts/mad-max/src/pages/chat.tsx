import { Navbar } from "@/components/navbar";
import { getListConversationsQueryKey, getListMessagesQueryKey, useListConversations, useListMessages, useSendMessage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, ShieldAlert, Link2, KeyRound, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { createChatMessagePayload } from "@/lib/authenticated-flow-contracts";
import {
  createDeviceLinkCode,
  createEncryptedKeyBackup,
  decryptMessagePayload,
  encryptMessage,
  hasStoredDeviceIdentity,
  parseDeviceLinkCode,
  registerDevice,
  restoreEncryptedKeyBackup,
} from "@/lib/e2ee";

export default function Chat() {
  const { user } = useUser();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [deviceReady, setDeviceReady] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [devices, setDevices] = useState<Array<{ deviceId: string; deviceName?: string; revoked: boolean }>>([]);
  const [decrypted, setDecrypted] = useState<Record<number, string>>({});
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [restoreCode, setRestoreCode] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [attachment, setAttachment] = useState<File | undefined>();
  const [decryptedAttachments, setDecryptedAttachments] = useState<Record<number, { name: string; type: string; data: string }>>({});
  
  const { data: conversations, isLoading: loadingConvs } = useListConversations();
  const { data: messages, isLoading: loadingMessages } = useListMessages(
    activeConvId || 0, 
    { query: { queryKey: getListMessagesQueryKey(activeConvId || 0), enabled: !!activeConvId, refetchInterval: 3000 } } // simple polling
  );
  
  const sendMessage = useSendMessage();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const downloadAttachment = (attachment: { name: string; type: string; data: string }) => {
    const bytes = Uint8Array.from(atob(attachment.data), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: attachment.type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const makeLinkCode = async () => {
    setRecoveryStatus("");
    try {
      const backup = await createEncryptedKeyBackup(recoveryPassphrase);
      const challengeBytes = crypto.getRandomValues(new Uint8Array(24));
      const challenge = btoa(String.fromCharCode(...challengeBytes));
      const response = await fetch("/api/chat/device-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge }),
      });
      if (!response.ok) throw new Error("Unable to start device linking.");
      setLinkCode(createDeviceLinkCode(challenge, backup));
      setRecoveryStatus("Code ready. Keep this page open while you enter it on the new device.");
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : "Unable to create a recovery code.");
    }
  };

  const restoreDevice = async () => {
    setRecoveryStatus("");
    try {
      const link = parseDeviceLinkCode(restoreCode);
      const current = await restoreEncryptedKeyBackup(link.backup, restorePassphrase);
      const response = await fetch(`/api/chat/device-links/${encodeURIComponent(link.challenge)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: current.deviceId,
          publicKey: JSON.stringify(current.publicKey),
          deviceName: `${navigator.platform} · Linked browser`,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "This link has expired. Create a new code.");
      }
      setRecoveryStatus("Device restored and linked securely.");
      setRestoreCode("");
      setRestorePassphrase("");
      setDeviceReady(true);
      setRecoveryAvailable(true);
      const refreshed = await fetch("/api/chat/devices");
      if (refreshed.ok) setDevices(await refreshed.json());
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : "Unable to restore this device.");
    }
  };

  useEffect(() => {
    setRecoveryAvailable(hasStoredDeviceIdentity());
    registerDevice().then(() => {
      setDeviceReady(true);
      setRecoveryAvailable(true);
      return fetch("/api/chat/devices").then((response) => response.ok ? response.json() : []);
    }).then(setDevices).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!messages) return;
    let cancelled = false;
    Promise.all(messages.map(async (msg) => [msg.id, await decryptMessagePayload(msg.content)] as const)).then((entries) => {
      if (!cancelled) {
        setDecrypted(Object.fromEntries(entries.map(([id, payload]) => [id, payload?.text || "Unable to decrypt this message"])));
        setDecryptedAttachments(Object.fromEntries(entries.filter((entry): entry is [number, { text: string; attachment: { name: string; type: string; size: number; data: string } }] => Boolean(entry[1]?.attachment)).map(([id, payload]) => [id, payload.attachment])));
      }
    });
    return () => { cancelled = true; };
  }, [messages]);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeConvId || !deviceReady) return;
    const devicesResponse = await fetch(`/api/chat/conversations/${activeConvId}/devices`);
    if (!devicesResponse.ok) return;
    const devices = await devicesResponse.json();
    const encryptedContent = await encryptMessage(message.trim(), devices, attachment);
    
    sendMessage.mutate(
      { id: activeConvId, data: createChatMessagePayload(encryptedContent) },
      { 
        onSuccess: () => {
          setMessage("");
          setAttachment(undefined);
          void queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConvId) });
          void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        }
      }
    );
  };

  const activeConv = conversations?.find(c => c.id === activeConvId);
  // Find the "other" participant
  const otherUser = activeConv?.participants?.find(p => p.clerkId !== user?.id) || activeConv?.participants?.[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 pt-24 pb-8 flex h-[calc(100vh-2rem)]">
        <div className="w-full bg-card border border-border rounded-lg overflow-hidden flex shadow-2xl">
          
          {/* Sidebar */}
          <div className="w-full md:w-80 border-r border-border flex flex-col bg-background/50">
            <div className="p-4 border-b border-border bg-card">
              <h2 className="font-display font-bold uppercase tracking-wider text-lg">Messages</h2>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-green-500">End-to-end encrypted</p>
              {deviceReady && <p className="mt-2 text-[10px] text-muted-foreground">{devices.length} secure device{devices.length === 1 ? "" : "s"} linked to this account</p>}
              {!recoveryAvailable && (
                <div className="mt-3 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>No encrypted recovery backup exists for this browser yet. Create a QR / code link before clearing browser storage.</span>
                </div>
              )}
              <Button variant="outline" size="sm" className="mt-3 w-full justify-start gap-2" onClick={() => setRecoveryOpen((open) => !open)}>
                <KeyRound className="h-4 w-4" />
                Device recovery & linking
              </Button>
              {recoveryOpen && (
                <div className="mt-3 space-y-3 rounded-md border border-border bg-background p-3 text-xs">
                  <p className="text-muted-foreground">
                    Recovery data is encrypted on this device. FILMIO never sees your passphrase or private key.
                  </p>
                  <div className="space-y-2">
                    <p className="font-bold uppercase tracking-wider">Link a new device</p>
                    <Input
                      type="password"
                      value={recoveryPassphrase}
                      onChange={(event) => setRecoveryPassphrase(event.target.value)}
                      placeholder="Recovery passphrase (12+ characters)"
                      className="h-9"
                    />
                    <Button size="sm" className="w-full gap-2" onClick={makeLinkCode} disabled={recoveryPassphrase.length < 12}>
                      <Link2 className="h-4 w-4" /> Generate secure link code
                    </Button>
                    {linkCode && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-amber-200">Enter this code on the new device. It expires in 10 minutes and works once.</p>
                        <div className="flex gap-1">
                          <textarea readOnly value={linkCode} className="min-h-20 w-full resize-none rounded border border-border bg-card p-2 text-[10px] break-all" />
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Copy device link code"
                            onClick={() => { void navigator.clipboard.writeText(linkCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                          >
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="font-bold uppercase tracking-wider">Restore on this device</p>
                    <textarea value={restoreCode} onChange={(event) => setRestoreCode(event.target.value)} placeholder="Paste the device link code" className="min-h-20 w-full resize-none rounded border border-border bg-card p-2 text-xs" />
                    <Input
                      type="password"
                      value={restorePassphrase}
                      onChange={(event) => setRestorePassphrase(event.target.value)}
                      placeholder="Recovery passphrase"
                      className="h-9"
                    />
                    <Button variant="secondary" size="sm" className="w-full" onClick={restoreDevice} disabled={!restoreCode || restorePassphrase.length < 12}>
                      Restore and link this device
                    </Button>
                  </div>
                  {recoveryStatus && <p className="text-[11px] text-muted-foreground">{recoveryStatus}</p>}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
                </div>
              ) : conversations && conversations.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {conversations.map(conv => {
                    const other = conv.participants?.find(p => p.clerkId !== user?.id) || conv.participants?.[0];
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
                           <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage ? "Encrypted message" : "No messages yet"}</p>
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
                             <p>{decrypted[msg.id] || "Decrypting securely…"}</p>
                             {decryptedAttachments[msg.id] && (
                               <button type="button" className="mt-2 block text-left text-xs underline opacity-80 hover:opacity-100" onClick={() => downloadAttachment(decryptedAttachments[msg.id])}>
                                 Download decrypted attachment: {decryptedAttachments[msg.id].name}
                               </button>
                             )}
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
                       disabled={sendMessage.isPending || !deviceReady}
                    />
                    <Button type="submit" size="icon" disabled={!message.trim() || sendMessage.isPending}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                  <label className="mt-2 block text-xs text-muted-foreground">
                    <span className="cursor-pointer hover:text-foreground">Attach a file (encrypted before sending)</span>
                    <input type="file" className="sr-only" onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (selected && selected.size <= 8 * 1024 * 1024) setAttachment(selected);
                      else if (selected) event.target.value = "";
                    }} disabled={sendMessage.isPending} />
                    {attachment && <span className="ml-2 text-foreground">{attachment.name}</span>}
                  </label>
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
