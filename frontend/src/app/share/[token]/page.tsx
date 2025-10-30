// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import s from "@/app/styles/dashboard.module.css";
import d from "@/app/styles/detail.module.css";

type SharedContent = {
  id: string;
  date: string;
  duration: string;
  transcript: string;
  summary: string;
  shared_at: string;
  view_count: number;
};

// Simple formatter to render the structured summary returned by the realtime summarizer.
// Supports **bold** markers, list items starting with '- ', and preserves line breaks.
function renderSummaryHtml(src: string | undefined | null) {
  if (!src) return "";
  // escape HTML
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const raw = escapeHtml(src);
  const lines = raw.split(/\r?\n/);
  let out: string[] = [];
  let inList = false;

  // Helper to close list if open
  const closeListIfOpen = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line === '') {
      // blank line -> close lists and add separator
      closeListIfOpen();
      out.push('<p></p>');
      continue;
    }

    // list item
    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      const item = line.substring(2).trim();
      const itemHtml = item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      out.push(`<li>${itemHtml}</li>`);
      continue;
    }

    // bold-only header line like **Heading** or **Heading:**
    const mHeader = line.match(/^\*\*(.+?)\*\*:?$/);
    if (mHeader) {
      // close any open list first
      closeListIfOpen();
      const headingText = mHeader[1].trim();
      out.push(`<h2>${headingText}</h2>`);
      continue;
    }

    // fallback: inline bold formatting
    const inline = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // If this line looks like a subheading (ends with ':'), render as bold paragraph
    if (/^.+:$/.test(line)) {
      out.push(`<div><strong>${inline.replace(/:$/, '')}</strong></div>`);
    } else {
      out.push(`<div>${inline}</div>`);
    }
  }

  closeListIfOpen();
  return out.join('\n');
}

export default function SharedContentPage() {
  const params = useParams();
  const token = params.token as string;

  const [content, setContent] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    const fetchSharedContent = async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/share/${token}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load shared content');
        }

        const data = await response.json();
        setContent(data);
      } catch (err: any) {
        console.error('Error fetching shared content:', err);
        setError(err.message || 'Failed to load shared content');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedContent();
  }, [token]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Text copied to clipboard!");
  };

  if (loading) {
    return (
      <div className={s.app}>
        <main className={s.content}>
          <div className={s.card}>Loading shared content...</div>
        </main>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className={s.app}>
        <main className={s.content}>
          <div className={s.card}>
            <h3>Shared Content Not Available</h3>
            <p>{error || "The shared content could not be found or is no longer available."}</p>
            <p style={{ fontSize: 12, color: '#666' }}>
              This could be because:
            </p>
            <ul style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              <li>The share link has expired</li>
              <li>The content has been deleted</li>
              <li>The share link is invalid</li>
            </ul>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={s.app}>
      {/* HEADER */}
      <header className={s.topbar}>
        <div className={s.tbWrap}>
          <div className={s.leftGroup}>
            <div className={s.brand}>
              <Image
                src="/logo_neurabot.jpg"
                alt="Logo Neurabot"
                width={36}
                height={36}
                className={s.brandImg}
              />
              <div className={s.brandName}>Neurabot</div>
            </div>
          </div>
          <div className={s.rightGroup}>
            <div style={{ fontSize: 14, color: '#666' }}>
              Shared Content
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className={s.content}>
        <div className={d.detailContainer}>
          {/* Header */}
          <div className={d.detailHeader}>
            <div className={d.headerInfo}>
              <h1 className={d.detailTitle}>Shared Transcription</h1>
              <div className={d.detailMeta}>
                <div className={d.metaItem}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  {new Date(content.date).toLocaleString()}
                </div>
                <div className={d.metaItem}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12,6 12,12 16,14"></polyline>
                  </svg>
                  {content.duration}
                </div>
                <div className={d.metaItem}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15,3 21,3 21,9"></polyline>
                    <path d="M10 14L21 3"></path>
                  </svg>
                  {content.view_count} views
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={d.detailContent}>
            {/* Transcript Section */}
            <section className={d.contentSection}>
              <div className={d.sectionHeader}>
                <h2 className={d.sectionTitle}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                  Full Transcript
                </h2>
                <button className={d.copyButton} onClick={() => handleCopy(content.transcript)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  </svg>
                  Copy
                </button>
              </div>
              <div className={d.transcriptContent}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{content.transcript}</div>
              </div>
            </section>

            {/* Summary Section */}
            <section className={d.contentSection}>
              <div className={d.sectionHeader}>
                <h2 className={d.sectionTitle}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10,9 9,9 8,9"></polyline>
                  </svg>
                  AI Summary
                </h2>
                <button className={d.copyButton} onClick={() => handleCopy(content.summary)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  </svg>
                  Copy
                </button>
              </div>
              <div className={d.summaryContent}>
                <div dangerouslySetInnerHTML={{ __html: renderSummaryHtml(content.summary) }} />
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className={d.footerActions}>
            <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
              This content was shared from Neurabot • Viewed {content.view_count} times
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
