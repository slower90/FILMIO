import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createChatMessagePayload } from "@/lib/authenticated-flow-contracts";
import { isConversationUnread } from "@/lib/chat-read-state";
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
import {
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  getGetFriendsOverviewQueryKey,
  useGetFriendsOverview,
  useCreateConversation,
  useListConversations,
  useListMessages,
  useSendMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api-url";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  Clipboard,
  FileText,
  Film,
  Info,
  KeyRound,
  Link2,
  LockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShieldEllipsis,
  X,
} from "lucide-react";
import { format, isToday } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

type LinkedDevice = { deviceId: string; deviceName?: string; revoked: boolean };
type DecryptedAttachment = { name: string; type: string; size: number; data: string };

function initials(name?: string | null) {
  return (name || "Film friend")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FF";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function Avatar({
  name,
  src,
  size = "md",
  active = false,
}: {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) {
  const dimensions = size === "lg" ? "h-12 w-12 text-sm" : size === "sm" ? "h-9 w-9 text-[10px]" : "h-10 w-10 text-xs";
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-[hsl(var(--surface-raised))] font-display font-semibold text-primary", dimensions)}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
      {active && <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400" aria-label="Active now" />}
    </span>
  );
}

function SecurityPill({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-display text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300",
        compact ? "whitespace-nowrap" : "rounded-sm border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-1",
      )}
      data-testid="status-end-to-end-encrypted"
    >
      <LockKeyhole className="h-3 w-3" />
      End-to-end encrypted
    </span>
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-1 p-3" aria-label="Loading conversations" data-testid="state-loading-conversations">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-3 border-b border-border/30 px-2 py-4">
          <div className="h-10 w-10 rounded-full bg-muted/70" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded bg-muted/70" />
            <div className="h-2.5 w-3/5 rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyConversationList({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex min-h-[18rem] flex-col items-center justify-center px-8 py-12 text-center" data-testid="state-empty-conversations">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.07] text-primary">
        <MessageCircle className="h-6 w-6" />
      </span>
      <p className="font-display text-sm font-semibold uppercase tracking-[0.16em]">No scenes yet</p>
      <p className="mt-2 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
        Start a private thread with someone who speaks fluent cinema.
      </p>
      <Button onClick={onNew} className="mt-5 h-9 gap-2 px-4 text-[10px] font-bold uppercase tracking-[0.14em]" data-testid="button-start-first-conversation">
        <Plus className="h-3.5 w-3.5" /> Start a conversation
      </Button>
    </div>
  );
}

function DeviceRecovery({
  open,
  onToggle,
  recoveryAvailable,
  deviceReady,
  devices,
  onStatus,
  onDevicesChange,
}: {
  open: boolean;
  onToggle: () => void;
  recoveryAvailable: boolean;
  deviceReady: boolean;
  devices: LinkedDevice[];
  onStatus: (status: string) => void;
  onDevicesChange: (devices: LinkedDevice[]) => void;
}) {
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [restoreCode, setRestoreCode] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [copied, setCopied] = useState(false);

  const makeLinkCode = async () => {
    onStatus("");
    try {
      const backup = await createEncryptedKeyBackup(recoveryPassphrase);
      const challengeBytes = crypto.getRandomValues(new Uint8Array(24));
      const challenge = btoa(String.fromCharCode(...challengeBytes));
      const response = await apiFetch("/api/chat/device-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge }),
      });
      if (!response.ok) throw new Error("Unable to start device linking.");
      setLinkCode(createDeviceLinkCode(challenge, backup));
      onStatus("Code ready. Keep this page open while you enter it on the new device.");
    } catch (error) {
      onStatus(getErrorMessage(error, "Unable to create a recovery code."));
    }
  };

  const restoreDevice = async () => {
    onStatus("");
    try {
      const link = parseDeviceLinkCode(restoreCode);
      const current = await restoreEncryptedKeyBackup(link.backup, restorePassphrase);
      const response = await apiFetch(`/api/chat/device-links/${encodeURIComponent(link.challenge)}/complete`, {
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
      onStatus("Device restored and linked securely.");
      setRestoreCode("");
      setRestorePassphrase("");
      const refreshed = await apiFetch("/api/chat/devices");
      if (refreshed.ok) {
        const nextDevices = await refreshed.json();
        onDevicesChange(Array.isArray(nextDevices) ? nextDevices : []);
        onStatus("Device restored and linked securely.");
        return;
      }
    } catch (error) {
      onStatus(getErrorMessage(error, "Unable to restore this device."));
    }
  };

  return (
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left transition-colors hover:bg-primary/[0.06]"
        aria-expanded={open}
        data-testid="button-toggle-device-recovery"
      >
        <span className="flex items-center gap-3">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-sm border", recoveryAvailable ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300" : "border-amber-400/30 bg-amber-400/[0.08] text-amber-300")}>
            <KeyRound className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-display text-[10px] font-bold uppercase tracking-[0.14em]">Device trust</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{recoveryAvailable ? `${devices.length || 1} linked device${devices.length === 1 ? "" : "s"}` : "Recovery backup not set"}</span>
          </span>
        </span>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/40 bg-[hsl(var(--surface-deep)/0.58)] px-5 py-4" data-testid="panel-device-recovery">
          <div className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p>Keys stay in this browser. FILMIO cannot read your passphrase or private key.</p>
          </div>

          <div className="space-y-2">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">Link another device</p>
            <Input
              type="password"
              value={recoveryPassphrase}
              onChange={(event) => setRecoveryPassphrase(event.target.value)}
              placeholder="Recovery passphrase · 12+ characters"
              className="h-9 bg-background/70 text-xs"
              data-testid="input-recovery-passphrase"
            />
            <Button onClick={makeLinkCode} disabled={recoveryPassphrase.length < 12} size="sm" className="h-9 w-full gap-2 text-[10px] font-bold uppercase tracking-[0.1em]" data-testid="button-generate-device-link">
              <Link2 className="h-3.5 w-3.5" /> Generate secure link
            </Button>
            {linkCode && (
              <div className="space-y-2">
                <p className="text-[10px] leading-relaxed text-amber-200/80">One-time code. It expires in 10 minutes. Never share your passphrase.</p>
                <div className="flex gap-2">
                  <textarea readOnly value={linkCode} className="min-h-16 w-full resize-none rounded-sm border border-border bg-background p-2 text-[9px] leading-relaxed text-muted-foreground" aria-label="Encrypted device link code" data-testid="text-device-link-code" />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Copy device link code"
                    onClick={() => {
                      void navigator.clipboard.writeText(linkCode);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1400);
                    }}
                    data-testid="button-copy-device-link"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Clipboard className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border/50 pt-4">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">Restore on this device</p>
            <textarea value={restoreCode} onChange={(event) => setRestoreCode(event.target.value)} placeholder="Paste encrypted device link code" className="min-h-16 w-full resize-none rounded-sm border border-border bg-background p-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary" data-testid="input-restore-code" />
            <Input type="password" value={restorePassphrase} onChange={(event) => setRestorePassphrase(event.target.value)} placeholder="Recovery passphrase" className="h-9 bg-background/70 text-xs" data-testid="input-restore-passphrase" />
            <Button variant="secondary" size="sm" onClick={restoreDevice} disabled={!restoreCode || restorePassphrase.length < 12} className="h-9 w-full text-[10px] font-bold uppercase tracking-[0.1em]" data-testid="button-restore-device">
              Restore and link this device
            </Button>
          </div>
          {!deviceReady && <p className="text-[10px] text-amber-200">Preparing this browser for encrypted messaging…</p>}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | undefined>();
  const [attachmentError, setAttachmentError] = useState("");
  const [deviceReady, setDeviceReady] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [decrypted, setDecrypted] = useState<Record<number, string>>({});
  const [decryptedAttachments, setDecryptedAttachments] = useState<Record<number, DecryptedAttachment>>({});
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [participantId, setParticipantId] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [readAt, setReadAt] = useState<Record<number, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [, setLocation] = useLocation();

  const conversationsQuery = useListConversations();
  const conversations = conversationsQuery.data;
  const friendsQuery = useGetFriendsOverview({ limit: 60 }, {
    query: {
      enabled: newConversationOpen,
      queryKey: getGetFriendsOverviewQueryKey({ limit: 60 }),
      staleTime: 30_000,
    },
  });
  const messagesQuery = useListMessages(activeConvId || 0, {
    query: {
      queryKey: getListMessagesQueryKey(activeConvId || 0),
      enabled: !!activeConvId,
      refetchInterval: 3000,
    },
  });
  const messages = messagesQuery.data;
  const sendMessage = useSendMessage();
  const createConversation = useCreateConversation();

  const activeConv = useMemo(() => conversations?.find((conversation) => conversation.id === activeConvId), [activeConvId, conversations]);
  const otherUser = useMemo(
    () => activeConv?.participants?.find((participant) => participant.clerkId !== user?.id) || activeConv?.participants?.[0],
    [activeConv, user?.id],
  );
  const filteredConversations = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return conversations || [];
    return (conversations || []).filter((conversation) => conversation.participants?.some((participant) => `${participant.displayName || ""} ${participant.username || ""}`.toLowerCase().includes(normalized)));
  }, [conversations, search]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("filmio.chat.read-at") || "{}");
      if (stored && typeof stored === "object") setReadAt(stored as Record<number, string>);
    } catch {
      setReadAt({});
    }
  }, []);

  useEffect(() => {
    if (!activeConvId || !messages?.length) return;
    const latestMessage = messages[messages.length - 1]?.createdAt;
    if (!latestMessage) return;
    setReadAt((current) => {
      const next = { ...current, [activeConvId]: latestMessage };
      try {
        localStorage.setItem("filmio.chat.read-at", JSON.stringify(next));
      } catch {
        // Local read markers are an enhancement and should never block messaging.
      }
      return next;
    });
  }, [activeConvId, messages]);

  useEffect(() => {
    setRecoveryAvailable(hasStoredDeviceIdentity());
    registerDevice()
      .then(() => {
        setDeviceReady(true);
        setRecoveryAvailable(true);
        return apiFetch("/api/chat/devices").then((response) => (response.ok ? response.json() : []));
      })
      .then((result) => setDevices(Array.isArray(result) ? result : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!conversations?.length || activeConvId) return;
    const requested = Number(new URLSearchParams(window.location.search).get("conv"));
    const requestedConversation = Number.isFinite(requested) ? conversations.find((conversation) => conversation.id === requested) : undefined;
    setActiveConvId(requestedConversation?.id ?? conversations[0].id);
    setMobileChatOpen(Boolean(requestedConversation));
  }, [activeConvId, conversations]);

  useEffect(() => {
    if (!messages) {
      setDecrypted({});
      setDecryptedAttachments({});
      return;
    }
    let cancelled = false;
    Promise.all(messages.map(async (msg) => ({ id: msg.id, payload: await decryptMessagePayload(msg.content) }))).then((entries) => {
      if (cancelled) return;
      const text: Record<number, string> = {};
      const files: Record<number, DecryptedAttachment> = {};
      entries.forEach(({ id, payload }) => {
        text[id] = payload?.text || "This message is unavailable on this device.";
        if (payload?.attachment) files[id] = payload.attachment;
      });
      setDecrypted(text);
      setDecryptedAttachments(files);
    });
    return () => {
      cancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    const node = messagesEndRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, activeConvId]);

  useEffect(() => {
    setMessage("");
    setAttachment(undefined);
    setAttachmentError("");
    setDetailsOpen(false);
    window.setTimeout(() => composerRef.current?.focus(), 80);
  }, [activeConvId]);

  const selectConversation = (id: number) => {
    setActiveConvId(id);
    setMobileChatOpen(true);
    setLocation(`/chat?conv=${id}`);
  };

  const downloadAttachment = (file: DecryptedAttachment) => {
    const bytes = Uint8Array.from(atob(file.data), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!message.trim() || !activeConvId || !deviceReady || sendMessage.isPending) return;
    setAttachmentError("");
    try {
      const devicesResponse = await apiFetch(`/api/chat/conversations/${activeConvId}/devices`);
      if (!devicesResponse.ok) throw new Error("Recipient devices are unavailable right now.");
      const recipientDevices = await devicesResponse.json();
      const encryptedContent = await encryptMessage(message.trim(), recipientDevices, attachment);
      sendMessage.mutate(
        { id: activeConvId, data: createChatMessagePayload(encryptedContent) },
        {
          onSuccess: () => {
            setMessage("");
            setAttachment(undefined);
            void queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConvId) });
            void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            composerRef.current?.focus();
          },
          onError: (error) => setAttachmentError(getErrorMessage(error, "The encrypted message could not be sent.")),
        },
      );
    } catch (error) {
      setAttachmentError(getErrorMessage(error, "Unable to encrypt this message."));
    }
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleCreateConversation = (event: React.FormEvent) => {
    event.preventDefault();
    const value = participantId.trim();
    if (!value) return;
    setConversationError("");
    createConversation.mutate(
      { data: { participantId: value } },
      {
        onSuccess: (conversation) => {
          setParticipantId("");
          setNewConversationOpen(false);
          setActiveConvId(conversation.id);
          setMobileChatOpen(true);
          void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
        onError: (error) => setConversationError(getErrorMessage(error, "That profile could not be reached.")),
      },
    );
  };

  const conversationName = otherUser?.displayName || otherUser?.username || "Film friend";
  const conversationBio = otherUser?.bio || "A private line for the next great scene.";

  return (
    <div className="film-grain min-h-[100dvh] bg-background text-foreground">
      <Navbar />
      <main className="flex min-h-[100dvh] flex-col pt-[4.75rem]" data-testid="page-chat">
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col border-x border-border/60 bg-[hsl(var(--surface-deep)/0.58)] lg:flex-row">
          <aside className={cn("flex w-full flex-col border-b border-border/70 bg-[hsl(var(--card)/0.84)] lg:w-[22rem] lg:shrink-0 lg:border-b-0 lg:border-r", mobileChatOpen && "hidden lg:flex")} aria-label="Conversations">
            <div className="border-b border-border/70 px-5 pb-4 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cinema-kicker">Private screening room</p>
                  <h1 className="mt-2 font-display text-2xl font-medium tracking-[-0.06em]">Messages</h1>
                </div>
                <Button variant="outline" size="icon" onClick={() => setNewConversationOpen(true)} className="h-9 w-9 rounded-sm border-primary/30 text-primary hover:bg-primary/10" aria-label="New conversation" data-testid="button-new-conversation">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <SecurityPill compact />
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{conversations?.length || 0} threads</span>
              </div>
              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="h-10 rounded-sm border-border/70 bg-background/60 pl-9 text-xs placeholder:text-muted-foreground/70" aria-label="Search conversations" data-testid="input-search-conversations" />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversationsQuery.isLoading ? (
                <ConversationSkeleton />
              ) : conversationsQuery.isError ? (
                <div className="flex min-h-[18rem] flex-col items-center justify-center px-8 text-center" data-testid="state-conversations-error">
                  <AlertCircle className="mb-3 h-7 w-7 text-destructive" />
                  <p className="font-display text-xs font-bold uppercase tracking-[0.14em]">The lobby is quiet</p>
                  <p className="mt-2 text-xs text-muted-foreground">We could not load your conversations.</p>
                  <Button onClick={() => void conversationsQuery.refetch()} variant="outline" size="sm" className="mt-4 h-9 text-[10px] uppercase tracking-wider" data-testid="button-retry-conversations">Try again</Button>
                </div>
              ) : filteredConversations.length ? (
                <div className="divide-y divide-border/40">
                  {filteredConversations.map((conversation) => {
                    const person = conversation.participants?.find((participant) => participant.clerkId !== user?.id) || conversation.participants?.[0];
                    const date = conversation.lastMessageAt;
                    return (
                      <button
                        type="button"
                        key={conversation.id}
                        onClick={() => selectConversation(conversation.id)}
                        className={cn("group flex min-h-[4.8rem] w-full items-center gap-3 px-5 text-left transition-colors hover:bg-primary/[0.055]", activeConvId === conversation.id ? "bg-primary/[0.1] shadow-[inset_2px_0_0_hsl(var(--primary))]" : "")}
                        aria-current={activeConvId === conversation.id ? "true" : undefined}
                        data-testid={`button-conversation-${conversation.id}`}
                      >
                        <Avatar name={person?.displayName || person?.username} src={person?.avatarUrl} active={conversation.id === activeConvId} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={cn("truncate text-sm font-semibold", activeConvId === conversation.id && "text-primary")} data-testid={`text-conversation-name-${conversation.id}`}>{person?.displayName || person?.username || "Film friend"}</span>
                             <span className="flex shrink-0 items-center gap-2">
                               {date && <time className="font-mono text-[9px] uppercase text-muted-foreground" dateTime={date}>{isToday(new Date(date)) ? format(new Date(date), "h:mm a") : format(new Date(date), "MMM d")}</time>}
                                {isConversationUnread(conversation.lastMessageAt, readAt[conversation.id], conversation.id === activeConvId) && (
                                 <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground" aria-label="Unread messages" data-testid={`badge-unread-${conversation.id}`}>!</span>
                               )}
                             </span>
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <LockKeyhole className="h-3 w-3 shrink-0 text-emerald-300/75" />
                            <span className="truncate">{conversation.lastMessage ? "Encrypted message" : "New encrypted thread"}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : conversations?.length ? (
                <div className="px-6 py-16 text-center" data-testid="state-no-conversation-results">
                  <Search className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                  <p className="font-display text-xs font-bold uppercase tracking-[0.14em]">No matching scenes</p>
                  <button type="button" onClick={() => setSearch("")} className="mt-3 text-xs text-primary underline underline-offset-4" data-testid="button-clear-conversation-search">Clear search</button>
                </div>
              ) : (
                <EmptyConversationList onNew={() => setNewConversationOpen(true)} />
              )}
            </div>

            <DeviceRecovery open={recoveryOpen} onToggle={() => setRecoveryOpen((open) => !open)} recoveryAvailable={recoveryAvailable} deviceReady={deviceReady} devices={devices} onStatus={setRecoveryStatus} onDevicesChange={(nextDevices) => { setDevices(nextDevices); setRecoveryAvailable(true); setDeviceReady(true); }} />
            {recoveryStatus && <p className="border-t border-border/50 px-5 py-3 text-[10px] leading-relaxed text-muted-foreground" role="status" data-testid="status-device-recovery">{recoveryStatus}</p>}
          </aside>

          <section className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col bg-[hsl(var(--background)/0.72)]", !mobileChatOpen && "hidden lg:flex")} aria-label={activeConv ? `Conversation with ${conversationName}` : "Conversation"}>
            {activeConv && otherUser ? (
              <>
                <header className="flex min-h-[4.65rem] items-center gap-3 border-b border-border/70 bg-[hsl(var(--card)/0.78)] px-4 sm:px-6">
                  <button type="button" onClick={() => setMobileChatOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-primary/10 hover:text-primary lg:hidden" aria-label="Back to conversations" data-testid="button-back-to-conversations"><ArrowLeft className="h-4 w-4" /></button>
                  <Avatar name={conversationName} src={otherUser.avatarUrl} size="lg" active />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-display text-base font-semibold tracking-[-0.025em]" data-testid="text-active-conversation-name">{conversationName}</h2>
                      {otherUser.isProfessional && <span className="hidden border-l border-primary/40 pl-2 font-display text-[9px] font-bold uppercase tracking-[0.14em] text-primary sm:inline">Professional</span>}
                    </div>
                   <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                       <LockKeyhole className="h-3 w-3 text-emerald-300" />
                       Encrypted channel · private by design
                    </p>
                  </div>
                  <div className="hidden items-center gap-3 md:flex"><SecurityPill compact /></div>
                  <button type="button" onClick={() => setDetailsOpen((open) => !open)} className={cn("flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary", detailsOpen && "bg-primary/10 text-primary")} aria-label="Conversation details" data-testid="button-toggle-conversation-details"><Info className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDetailsOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" aria-label="More conversation actions" data-testid="button-more-conversation-actions"><MoreHorizontal className="h-4 w-4" /></button>
                </header>

                {detailsOpen && (
                  <div className="absolute right-3 top-[4.8rem] z-20 w-[min(20rem,calc(100%-1.5rem))] border border-border bg-[hsl(var(--card))] p-4 shadow-2xl" data-testid="panel-conversation-details">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3"><Avatar name={conversationName} src={otherUser.avatarUrl} /><div><p className="text-sm font-semibold">{conversationName}</p><p className="text-[10px] text-muted-foreground">@{otherUser.username || "film-friend"}</p></div></div>
                      <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close conversation details" className="text-muted-foreground hover:text-foreground" data-testid="button-close-conversation-details"><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-4 border-l-2 border-primary/50 pl-3 text-xs leading-relaxed text-muted-foreground">{conversationBio}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3"><SecurityPill compact /><Link href={`/profile/${otherUser.id}`} className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-primary hover:text-primary/80" data-testid="link-view-conversation-profile">View profile</Link></div>
                  </div>
                )}

                <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
                    <span className="border-x border-b border-border/50 bg-[hsl(var(--card)/0.6)] px-3 py-1 font-display text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Private screening</span>
                  </div>
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pt-6">
                    {messagesQuery.isLoading ? (
                      <div className="space-y-4 pt-8" aria-label="Loading messages" data-testid="state-loading-messages">
                        <div className="flex gap-2"><div className="h-10 w-3/5 animate-pulse rounded-sm bg-muted/60" /></div>
                        <div className="flex justify-end gap-2"><div className="h-14 w-2/5 animate-pulse rounded-sm bg-primary/20" /></div>
                        <div className="flex gap-2"><div className="h-12 w-1/2 animate-pulse rounded-sm bg-muted/60" /></div>
                      </div>
                    ) : messagesQuery.isError ? (
                      <div className="flex flex-1 flex-col items-center justify-center py-28 text-center" data-testid="state-messages-error">
                        <AlertCircle className="mb-3 h-7 w-7 text-destructive" />
                        <p className="font-display text-xs font-bold uppercase tracking-[0.14em]">Scene unavailable</p>
                        <p className="mt-2 text-xs text-muted-foreground">Your encrypted messages could not be loaded.</p>
                        <Button onClick={() => void messagesQuery.refetch()} variant="outline" size="sm" className="mt-4 h-9 text-[10px] uppercase tracking-wider" data-testid="button-retry-messages">Try again</Button>
                      </div>
                    ) : messages?.length ? (
                      <>
                        <div className="my-2 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground"><span className="h-px flex-1 bg-border/60" />Today<span className="h-px flex-1 bg-border/60" /></div>
                        {messages.map((msg) => {
                          const isMe = msg.senderId === user?.id;
                          const time = new Date(msg.createdAt);
                          const file = decryptedAttachments[msg.id];
                          return (
                            <div key={msg.id} className={cn("flex max-w-[88%] items-end gap-2 sm:max-w-[72%]", isMe ? "ml-auto flex-row-reverse" : "mr-auto")} data-testid={`message-row-${msg.id}`}>
                              {!isMe && <Avatar name={msg.senderName || conversationName} src={msg.senderAvatarUrl || otherUser.avatarUrl} size="sm" />}
                              <div className={cn("min-w-0", isMe ? "items-end" : "items-start")}>
                                <div className={cn("border px-3.5 py-2.5 shadow-sm", isMe ? "border-primary/40 bg-primary text-primary-foreground [border-radius:0.7rem_0.7rem_0.15rem_0.7rem]" : "border-border/80 bg-[hsl(var(--surface-raised))] [border-radius:0.7rem_0.7rem_0.7rem_0.15rem]")} data-testid={`message-bubble-${msg.id}`}>
                                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed" data-testid={`text-message-${msg.id}`}>{decrypted[msg.id] || "Decrypting securely…"}</p>
                                  {file && (
                                    <button type="button" onClick={() => downloadAttachment(file)} className={cn("mt-3 flex max-w-full items-center gap-2 border-t pt-2 text-left text-[11px] underline underline-offset-2", isMe ? "border-primary-foreground/20 text-primary-foreground/80" : "border-border text-muted-foreground")} data-testid={`button-download-attachment-${msg.id}`}>
                                      <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{file.name}</span>
                                    </button>
                                  )}
                                </div>
                                <div className={cn("mt-1 flex items-center gap-1.5 px-1 text-[9px] font-mono text-muted-foreground", isMe ? "justify-end" : "justify-start")}>
                                  <time dateTime={msg.createdAt} data-testid={`time-message-${msg.id}`}>{format(time, "h:mm a")}</time>
                                  {isMe && <CheckCheck className="h-3 w-3 text-primary" aria-label="Sent and encrypted" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center py-28 text-center" data-testid="state-empty-messages">
                        <Film className="mb-4 h-8 w-8 text-primary/60" />
                        <p className="font-display text-sm font-semibold uppercase tracking-[0.16em]">First frame</p>
                        <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">Send the opening line. This conversation is encrypted before it leaves your device.</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="border-t border-border/70 bg-[hsl(var(--card)/0.9)] px-3 pb-3 pt-3 sm:px-6 sm:pb-5">
                  <div className="mx-auto max-w-3xl">
                    {attachment && (
                      <div className="mb-2 flex items-center justify-between gap-2 border-l-2 border-primary bg-primary/[0.07] px-3 py-2 text-[11px]" data-testid="status-selected-attachment">
                        <span className="flex min-w-0 items-center gap-2"><Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{attachment.name}</span><span className="shrink-0 text-muted-foreground">({Math.ceil(attachment.size / 1024)} KB)</span></span>
                        <button type="button" onClick={() => setAttachment(undefined)} className="text-muted-foreground hover:text-foreground" aria-label="Remove attachment" data-testid="button-remove-attachment"><X className="h-4 w-4" /></button>
                      </div>
                    )}
                    {attachmentError && <p className="mb-2 text-[11px] text-destructive" role="alert" data-testid="status-compose-error">{attachmentError}</p>}
                    <form onSubmit={(event) => void handleSend(event)} className="flex items-end gap-2">
                      <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border bg-background/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary" aria-label="Attach encrypted file" data-testid="button-attach-file">
                        <Paperclip className="h-4 w-4" />
                        <input type="file" className="sr-only" onChange={(event) => {
                          const selected = event.target.files?.[0];
                          if (selected && selected.size <= 8 * 1024 * 1024) {
                            setAttachment(selected);
                            setAttachmentError("");
                          } else if (selected) {
                            setAttachmentError("Attachments must be 8 MB or smaller.");
                            event.target.value = "";
                          }
                        }} disabled={sendMessage.isPending || !deviceReady} data-testid="input-attachment" />
                      </label>
                      <textarea ref={composerRef} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleComposerKeyDown} disabled={sendMessage.isPending || !deviceReady} placeholder={deviceReady ? "Write a message…" : "Preparing secure device…"} rows={1} className="max-h-32 min-h-11 flex-1 resize-none rounded-sm border border-border bg-background/65 px-3.5 py-3 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Message" data-testid="input-message-compose" />
                      <Button type="submit" disabled={!message.trim() || sendMessage.isPending || !deviceReady} className="h-11 w-11 shrink-0 rounded-sm p-0" aria-label="Send encrypted message" data-testid="button-send-message">
                        {sendMessage.isPending ? <span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </form>
                    <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[9px] uppercase tracking-[0.13em] text-muted-foreground">
                      <span className="flex items-center gap-1.5"><LockKeyhole className="h-3 w-3 text-emerald-300" />Encrypted on this device</span>
                      <span className="hidden sm:inline">Enter to send · Shift + Enter for line break</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center" data-testid="state-no-active-conversation">
                <div className="relative mb-7 flex h-24 w-24 items-center justify-center border border-primary/25 bg-primary/[0.05]">
                  <Film className="h-9 w-9 text-primary" />
                  <span className="absolute -right-2 top-3 h-1.5 w-8 bg-primary/60" />
                  <span className="absolute -left-2 bottom-3 h-1.5 w-8 bg-primary/30" />
                </div>
                <p className="cinema-kicker">FILMIO direct</p>
                <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.06em] sm:text-4xl">Choose a conversation</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Your private screening room is ready. Pick a thread or start one with a fellow film lover.</p>
                <Button onClick={() => setNewConversationOpen(true)} className="mt-7 h-10 gap-2 rounded-sm text-[10px] font-bold uppercase tracking-[0.14em]" data-testid="button-start-conversation-empty"><Plus className="h-4 w-4" /> New conversation</Button>
              </div>
            )}
          </section>
        </div>
      </main>

      {newConversationOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setNewConversationOpen(false); }} data-testid="dialog-new-conversation">
          <div role="dialog" aria-modal="true" aria-labelledby="new-conversation-title" className="w-full max-w-md border border-border bg-[hsl(var(--card))] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="cinema-kicker">New screening</p><h2 id="new-conversation-title" className="mt-2 font-display text-2xl font-medium tracking-[-0.05em]">Open a private line</h2></div>
              <button type="button" onClick={() => setNewConversationOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close new conversation dialog" data-testid="button-close-new-conversation"><X className="h-5 w-5" /></button>
            </div>
             <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Choose someone from your FILMIO circle. Messages are encrypted before they leave your device.</p>
             <form onSubmit={handleCreateConversation} className="mt-5 space-y-3">
               <div className="max-h-64 overflow-y-auto border border-border/60 bg-background/35" aria-label="Friends to message">
                 {friendsQuery.isLoading ? (
                   <div className="space-y-3 p-4" aria-label="Loading friends">
                     {[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse bg-muted/60" />)}
                   </div>
                 ) : friendsQuery.data?.friends?.length ? (
                   friendsQuery.data.friends.map((friend) => {
                     const name = friend.displayName || friend.username || "Film friend";
                     const selected = participantId === String(friend.id);
                     return (
                       <button
                         key={friend.id}
                         type="button"
                         onClick={() => { setParticipantId(String(friend.id)); setConversationError(""); }}
                         className={cn("flex w-full items-center gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors last:border-0 hover:bg-primary/[0.06]", selected && "bg-primary/[0.1]")}
                         aria-pressed={selected}
                         data-testid={`button-new-conversation-friend-${friend.id}`}
                       >
                         <Avatar name={name} src={friend.avatarUrl} size="sm" />
                         <span className="min-w-0 flex-1">
                           <span className="block truncate text-sm font-semibold">{name}</span>
                           <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{friend.username ? `@${friend.username}` : "FILMIO friend"}</span>
                         </span>
                         {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                       </button>
                     );
                   })
                 ) : (
                   <div className="px-5 py-8 text-center">
                     <p className="font-display text-xs font-bold uppercase tracking-[0.14em]">No friends to message yet</p>
                     <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Add someone to your screening circle first.</p>
                     <Link href="/friends" className="mt-4 inline-flex text-xs font-semibold text-primary underline underline-offset-4" onClick={() => setNewConversationOpen(false)}>Find friends</Link>
                   </div>
                 )}
               </div>
               {conversationError && <p className="flex items-center gap-2 text-xs text-destructive" role="alert" data-testid="status-new-conversation-error"><AlertCircle className="h-3.5 w-3.5" />{conversationError}</p>}
               <Button type="submit" disabled={!participantId.trim() || createConversation.isPending} className="h-11 w-full rounded-sm text-[10px] font-bold uppercase tracking-[0.14em]" data-testid="button-create-conversation">{createConversation.isPending ? "Opening line…" : "Start conversation"}</Button>
             </form>
            <div className="mt-6 flex items-start gap-2 border-t border-border/60 pt-4 text-[10px] leading-relaxed text-muted-foreground"><ShieldEllipsis className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><span>Only encrypted envelopes are stored by FILMIO. Your private key stays on this device.</span></div>
          </div>
        </div>
      )}
    </div>
  );
}