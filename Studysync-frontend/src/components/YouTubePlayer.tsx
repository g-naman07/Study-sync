import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4444";

interface YouTubePlayerProps {
    videoId?: string;
    playlistId?: string;
    isPlaying: boolean;
}

interface NotesApiResponse {
    success: boolean;
    notes?: string;
    error?: string;
}

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        display: "flex",
        flexDirection: "row",
        gap: "24px",
        width: "100%",
        height: "100%",
        minHeight: "480px",
        boxSizing: "border-box",
        transition: "all 0.3s ease-in-out",
    },
    playerWrapper: {
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        background: "#000",
    },
    playerContainer: {
        width: "100%",
        height: "100%",
        border: "none",
    },
    // NEW: Styled to sit above the video as a toolbar button
    toggleBtnAction: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 18px",
        background: "rgba(79, 70, 229, 0.9)", // Indigo
        color: "#ffffff",
        border: "1px solid rgba(165, 180, 252, 0.3)",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
        marginBottom: "12px", // Pushes the video down slightly
    },
    notesPanel: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0f0f0f",
        border: "1px solid #2a2a2a",
        borderRadius: "14px",
        overflow: "hidden",
    },
    notesHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 20px",
        borderBottom: "1px solid #1e1e1e",
        flexShrink: 0,
    },
    notesTitle: {
        fontSize: "16px",
        fontWeight: 700,
        color: "#f0f0f0",
        margin: 0,
        letterSpacing: "0.01em",
    },
    generateBtn: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 18px",
        background: "#4f46e5",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
    },
    generateBtnDisabled: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 18px",
        background: "#2d2a5e",
        color: "#7c78b8",
        border: "none",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "not-allowed",
        whiteSpace: "nowrap",
    },
    spinner: {
        width: "14px",
        height: "14px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTop: "2px solid #fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        display: "inline-block",
        flexShrink: 0,
    },
    errorBanner: {
        margin: "12px 16px 0",
        padding: "12px 16px",
        background: "rgba(220,38,38,0.1)",
        border: "1px solid rgba(220,38,38,0.3)",
        borderRadius: "8px",
        color: "#f87171",
        fontSize: "13px",
        lineHeight: "1.5",
        flexShrink: 0,
    },
    notesContent: {
        flex: "1 1 auto",
        overflowY: "auto",
        padding: "20px",
        color: "#d4d4d8",
        fontSize: "14px",
        lineHeight: "1.75",
    },
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "12px",
        color: "#555",
        fontSize: "13px",
        textAlign: "center",
        padding: "24px",
    },
    emptyIcon: {
        fontSize: "36px",
        opacity: 0.4,
    },
};

const markdownCSS = `
@keyframes spin { to { transform: rotate(360deg); } }

.yt-notes-prose h1,
.yt-notes-prose h2,
.yt-notes-prose h3 {
    color: #e4e4e7;
    font-weight: 700;
    margin-top: 1.4em;
    margin-bottom: 0.5em;
    line-height: 1.3;
}
.yt-notes-prose h1 { font-size: 1.25em; }
.yt-notes-prose h2 { font-size: 1.1em; border-bottom: 1px solid #2a2a2a; padding-bottom: 6px; }
.yt-notes-prose h3 { font-size: 1em; color: #a5b4fc; }
.yt-notes-prose p { margin: 0.6em 0 1em; color: #c4c4cc; }
.yt-notes-prose ul,
.yt-notes-prose ol { padding-left: 1.4em; margin: 0.5em 0 1em; }
.yt-notes-prose li { margin-bottom: 0.35em; color: #b0b0bb; }
.yt-notes-prose strong { color: #f0f0f0; font-weight: 600; }
.yt-notes-prose em { color: #a5b4fc; font-style: italic; }
.yt-notes-prose code {
    background: #1e1e2e;
    color: #a5b4fc;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.85em;
    font-family: 'Fira Code', monospace;
}
.yt-notes-prose pre {
    background: #141420;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    margin: 1em 0;
}
.yt-notes-prose pre code { background: none; padding: 0; color: #c9d1d9; font-size: 0.82em; }
.yt-notes-prose blockquote {
    border-left: 3px solid #4f46e5;
    margin: 1em 0;
    padding: 6px 16px;
    background: rgba(79,70,229,0.07);
    border-radius: 0 6px 6px 0;
    color: #9ca3af;
    font-style: italic;
}
.yt-notes-prose hr { border: none; border-top: 1px solid #2a2a2a; margin: 1.5em 0; }
.yt-notes-scroll::-webkit-scrollbar { width: 6px; }
.yt-notes-scroll::-webkit-scrollbar-track { background: transparent; }
.yt-notes-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.yt-notes-scroll::-webkit-scrollbar-thumb:hover { background: #4f46e5; }
`;

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, playlistId, isPlaying }) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [notes, setNotes] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>("");
    
    // Manage visibility of the notes panel
    const [showNotes, setShowNotes] = useState<boolean>(false);

    useEffect(() => {
        const id = "yt-notes-style";
        if (!document.getElementById(id)) {
            const tag = document.createElement("style");
            tag.id = id;
            tag.textContent = markdownCSS;
            document.head.appendChild(tag);
        }
    }, []);

    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        const onYouTubeIframeAPIReady = () => {
            const playerConfig: any = {
                height: '100%',
                width: '100%',
                playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
                events: {
                    onReady: (event: any) => {
                        if (isPlaying) event.target.playVideo();
                        else event.target.pauseVideo();
                    }
                }
            };

            if (playlistId) {
                playerConfig.playerVars.listType = 'playlist';
                playerConfig.playerVars.list = playlistId;
            } else if (videoId) {
                playerConfig.videoId = videoId;
            }

            playerRef.current = new window.YT.Player(containerRef.current, playerConfig);
        };

        if (window.YT && window.YT.Player) {
            onYouTubeIframeAPIReady();
        } else {
            window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
        }

        return () => { if (playerRef.current) playerRef.current.destroy(); };
    }, [videoId, playlistId]);

    useEffect(() => {
        if (!playerRef.current?.playVideo) return;
        isPlaying ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
    }, [isPlaying]);

    const handleGenerateNotes = async () => {
        if (!videoId) {
            setErrorMsg("Notes can only be generated for single videos, not playlists.");
            return;
        }
        setIsGenerating(true);
        setErrorMsg("");
        setNotes("");

        try {
            const response = await fetch(`${API_URL}/api/generate-notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl: `https://www.youtube.com/watch?v=${videoId}` })
            });
            const data = (await response.json()) as NotesApiResponse;
            if (data.success && data.notes) {
                setNotes(data.notes);
            } else {
                setErrorMsg(data.error || "An unknown error occurred.");
            }
        } catch (error) {
            console.error("Network error:", error);
            setErrorMsg(`Failed to connect to the backend server at ${API_URL}.`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div style={styles.wrapper}>
            {/* LEFT: Video Column */}
            <div style={{
                display: "flex",
                flexDirection: "column",
                flex: showNotes ? "0 0 65%" : "0 0 100%",
                maxWidth: showNotes ? "65%" : "100%",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
                
                {/* NEW: Toolbar sitting OUTSIDE and ABOVE the video player */}
                {videoId && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                        <button 
                            onClick={() => setShowNotes(!showNotes)}
                            style={styles.toggleBtnAction}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(79, 70, 229, 1)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(79, 70, 229, 0.9)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {showNotes ? "✕ Hide AI Notes" : "📝 Show AI Notes"}
                        </button>
                    </div>
                )}

                {/* Video Player */}
                <div style={styles.playerWrapper}>
                    <div ref={containerRef} style={styles.playerContainer} />
                </div>
            </div>

            {/* RIGHT: Notes Panel */}
            {videoId && showNotes && (
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minWidth: 0,
                    animation: "fadeIn 0.3s ease-in-out",
                }}>
                    <div style={styles.notesPanel}>
                        <div style={styles.notesHeader}>
                            <h3 style={styles.notesTitle}>✦ AI Lecture Notes</h3>
                            <button
                                onClick={handleGenerateNotes}
                                disabled={isGenerating}
                                style={isGenerating ? styles.generateBtnDisabled : styles.generateBtn}
                            >
                                {isGenerating ? (
                                    <>
                                        <span style={styles.spinner} />
                                        Analyzing…
                                    </>
                                ) : (
                                    "Generate Notes"
                                )}
                            </button>
                        </div>

                        {errorMsg && (
                            <div style={styles.errorBanner}>{errorMsg}</div>
                        )}

                        <div style={styles.notesContent} className="yt-notes-scroll">
                            {notes ? (
                                <article className="yt-notes-prose">
                                    <ReactMarkdown>{notes}</ReactMarkdown>
                                </article>
                            ) : (
                                !errorMsg && (
                                    <div style={styles.emptyState}>
                                        <span style={styles.emptyIcon}>📋</span>
                                        <span>Click <strong style={{ color: "#a5b4fc" }}>Generate Notes</strong> to extract key insights from this video.</span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            <style>
                {`@keyframes fadeIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }`}
            </style>
        </div>
    );
};

export default YouTubePlayer;

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}
