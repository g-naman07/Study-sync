// src/index.ts
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

const require = createRequire(import.meta.url);
const { YoutubeTranscript } = require('youtube-transcript');

dotenv.config();

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ==========================================
// 1. SOCKET.IO SETUP (Study Sync Rooms)
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// NEW: Store the active video for each room in memory
const roomVideos = new Map<string, string>();

io.on('connection', (socket) => {
    console.log(`[+] User connected: ${socket.id}`);

    // Join a study room
    socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        // NEW: If a video is already playing in this room, send it to the new user!
        if (roomVideos.has(roomId)) {
            socket.emit('sync-video', roomVideos.get(roomId));
        }
    });

    // NEW: Listen for when a user confirms a video link
    socket.on('set-video', ({ roomId, videoId }) => {
        console.log(`Setting video ${videoId} for room ${roomId}`);
        roomVideos.set(roomId, videoId);
        // Tell everyone else in the room to load this video
        socket.to(roomId).emit('sync-video', videoId);
    });

    // Handle distraction events
    socket.on('distraction-detected', (roomId: string) => {
        console.log(`[!] Distraction detected in room ${roomId} by user ${socket.id}`);
        
        // Broadcast a pause command to everyone ELSE in the room
        socket.to(roomId).emit('pause-session', {
            message: "A user got distracted. Pausing the session.",
            triggeredBy: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log(`[-] User disconnected: ${socket.id}`);
    });
});

// ==========================================
// 2. GEMINI API SETUP (Note Generation)
// ==========================================
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is missing from .env");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);

interface GenerateNotesRequest {
    videoUrl: string;
}

app.post('/api/generate-notes', async (req: Request<{}, {}, GenerateNotesRequest>, res: Response): Promise<void> => {
    const { videoUrl } = req.body;

    if (!videoUrl) {
        res.status(400).json({ success: false, error: "No video URL provided." });
        return;
    }

    try {
        const transcriptArray = await YoutubeTranscript.fetchTranscript(videoUrl);
        let fullTranscript = transcriptArray.map((t: any) => t.text).join(' ');

        if (fullTranscript.length > 80000) {
            fullTranscript = fullTranscript.substring(0, 80000);
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
            You are an expert study assistant. I am going to give you the transcript of an educational video. 
            Please provide a comprehensive set of study notes based on this text.
            Format the output in clean Markdown.
            Include:
            - A brief 2-sentence overview.
            - Core Concepts (bullet points).
            - Key Terms and Definitions (if applicable).
            
            Here is the transcript: 
            ${fullTranscript}
        `;

        const result = await model.generateContent(prompt);
        const notes = result.response.text();

        res.json({ success: true, notes: notes });

    } catch (error: any) {
        console.error("Pipeline Error:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "Failed to generate notes. The video might not have captions enabled." 
        });
    }
});

// ==========================================
// 3. START SERVER
// ==========================================
const PORT = process.env.PORT || 4444;
server.listen(PORT, () => console.log(`TS Server & WebSockets running on port ${PORT}`));