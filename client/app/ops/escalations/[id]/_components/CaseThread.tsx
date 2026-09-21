import { Bot, Info, User } from "lucide-react";

type Message = {
  id: string;
  role: string;
  content: string;
  provider?: string | null;
  createdAt: string;
};

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function MessageRoleIcon({ role }: { role: string }) {
  const r = role.toLowerCase();
  const common = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };
  if (r === "user" || r === "customer" || r === "traveller") {
    return <User className="fo-ops-case__msg-icon fo-ops-case__msg-icon--user" {...common} />;
  }
  if (r === "assistant" || r === "ai" || r === "ava") {
    return <Bot className="fo-ops-case__msg-icon fo-ops-case__msg-icon--assistant" {...common} />;
  }
  return <Info className="fo-ops-case__msg-icon" {...common} />;
}

export function CaseThread({ messages }: { messages: Message[] }) {
  if (!messages.length) {
    return (
      <p className="fo-ops-case__empty">
        No messages were present at handoff time (empty conversation snapshot).
      </p>
    );
  }

  return (
    <ul className="fo-ops-case__thread">
      {messages.map((m) => (
        <li key={m.id} className="fo-ops-case__msg">
          <MessageRoleIcon role={m.role} />
          <div className="fo-ops-case__msg-head">
            <span className="fo-ops-case__msg-role">
              {labelize(m.role)}
              {m.provider ? ` · ${m.provider}` : ""}
            </span>
            <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString()}</time>
          </div>
          <p className="fo-ops-case__msg-body">{m.content}</p>
        </li>
      ))}
    </ul>
  );
}
