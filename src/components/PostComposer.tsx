"use client";

import { useState, useEffect } from "react";

interface Account {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
}

interface Post {
  id: string;
  content: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  error_message: string | null;
  created_at: string;
  accounts: {
    username: string;
    display_name: string | null;
  } | null;
}

export default function PostComposer() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchAccounts();
    fetchPosts();
  }, []);

  async function fetchAccounts() {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    if (data.accounts && data.accounts.length > 0) {
      setAccounts(data.accounts);
      setSelectedAccount(data.accounts[0].id);
    }
  }

  async function fetchPosts() {
    const res = await fetch("/api/posts");
    const data = await res.json();
    if (data.posts) {
      setPosts(data.posts);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !selectedAccount) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: selectedAccount,
          content: content.trim(),
          scheduled_at: scheduledAt || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
        return;
      }

      setMessage({
        type: "success",
        text: scheduledAt
          ? "Tweet programado exitosamente"
          : "Tweet guardado como borrador",
      });
      setContent("");
      setScheduledAt("");
      fetchPosts();
    } catch {
      setMessage({ type: "error", text: "Error al guardar el tweet" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePublishNow(postId: string) {
    setPublishingId(postId);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "¡Tweet publicado exitosamente!" });
      } else {
        setMessage({
          type: "error",
          text: `Error al publicar: ${data.error || "desconocido"}`,
        });
      }

      fetchPosts();
    } catch {
      setMessage({ type: "error", text: "Error al publicar el tweet" });
    } finally {
      setPublishingId(null);
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, { text: string; color: string }> = {
      draft: { text: "Borrador", color: "bg-gray-600" },
      scheduled: { text: "Programado", color: "bg-yellow-600" },
      publishing: { text: "Publicando...", color: "bg-blue-600" },
      published: { text: "Publicado", color: "bg-green-600" },
      failed: { text: "Falló", color: "bg-red-600" },
    };
    return labels[status] || { text: status, color: "bg-gray-600" };
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4"
      >
        <h2 className="text-xl font-semibold">Nuevo Tweet</h2>

        {accounts.length === 0 ? (
          <p className="text-gray-400">
            No hay cuentas conectadas. Conectá tu cuenta de X primero.
          </p>
        ) : (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cuenta</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username}{" "}
                    {acc.display_name ? `(${acc.display_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Contenido
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={280}
                rows={4}
                placeholder="¿Qué querés publicar?"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white resize-none"
              />
              <p
                className={`text-sm mt-1 ${
                  content.length > 260 ? "text-yellow-400" : "text-gray-500"
                }`}
              >
                {content.length}/280
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Programar para (opcional)
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>

            {message && (
              <div
                className={`px-4 py-2 rounded ${
                  message.type === "success"
                    ? "bg-green-900/50 border border-green-500 text-green-300"
                    : "bg-red-900/50 border border-red-500 text-red-300"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition w-full"
            >
              {isSubmitting
                ? "Guardando..."
                : scheduledAt
                ? "Programar Tweet"
                : "Guardar como Borrador"}
            </button>
          </>
        )}
      </form>

      {/* Lista de posts */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Mis Posts</h2>
        {posts.length === 0 ? (
          <p className="text-gray-400">No hay posts todavía.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const statusInfo = getStatusLabel(post.status);
              return (
                <div
                  key={post.id}
                  className="border border-gray-700 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      @{post.accounts?.username || "desconocido"}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${statusInfo.color} text-white`}
                    >
                      {statusInfo.text}
                    </span>
                  </div>
                  <p className="text-white">{post.content}</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Creado: {formatDate(post.created_at)}</p>
                    {post.scheduled_at && (
                      <p>Programado para: {formatDate(post.scheduled_at)}</p>
                    )}
                    {post.published_at && (
                      <p>Publicado: {formatDate(post.published_at)}</p>
                    )}
                    {post.error_message && (
                      <p className="text-red-400">Error: {post.error_message}</p>
                    )}
                    {post.platform_post_id && (
                      <a
                        href={`https://twitter.com/i/web/status/${post.platform_post_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        Ver en X →
                      </a>
                    )}
                  </div>

                  {/* Botón publicar ahora */}
                  {(post.status === "draft" || post.status === "scheduled" || post.status === "failed") && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      disabled={publishingId === post.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm px-4 py-1 rounded transition"
                    >
                      {publishingId === post.id
                        ? "Publicando..."
                        : "Publicar ahora"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}