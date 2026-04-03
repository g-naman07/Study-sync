import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, AlertCircle, Download, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SessionLog {
  type: string;
  time: number;
  status: 'distracted' | 'focused';
}

interface SessionStatsProps {
  logs: SessionLog[];
  startTime: number;
  endTime: number;
  onReset: () => void;
}

const SessionStats: React.FC<SessionStatsProps> = ({ logs, startTime, endTime, onReset }) => {
  const totalDurationMs = endTime - startTime;
  const totalDurationMin = Math.round(totalDurationMs / 60000);
  
  // Calculate distraction time
  let totalDistractedMs = 0;
  const distractionCounts: Record<string, number> = {};

  for (let i = 0; i < logs.length; i++) {
    if (logs[i].status === 'distracted') {
      const start = logs[i].time;
      const end = logs[i + 1] ? logs[i + 1].time : endTime;
      totalDistractedMs += (end - start);
      
      const type = logs[i].type;
      distractionCounts[type] = (distractionCounts[type] || 0) + 1;
    }
  }

  const focusTimeMs = totalDurationMs - totalDistractedMs;
  const focusPercentage = totalDurationMs > 0
    ? Math.max(0, Math.min(100, Math.round((focusTimeMs / totalDurationMs) * 100)))
    : 0;
  const totalDistractions = Object.values(distractionCounts).reduce((sum, count) => sum + count, 0);

  const chartData = {
    labels: Object.keys(distractionCounts),
    datasets: [
      {
        label: 'Distraction count',
        data: Object.values(distractionCounts),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
    ],
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Add styling and header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('StudySync Focus Report', 20, 25);
    
    const dateStr = new Date(startTime).toLocaleString();
    doc.setFontSize(10);
    doc.text(`Generated on: ${dateStr}`, 140, 25);

    // Summary Section
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.text('Session Summary', 20, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Metric', 'Value']],
      body: [
        ['Total Session Time', `${totalDurationMin} minutes`],
        ['Focus Time', `${Math.round(focusTimeMs / 60000)} minutes`],
        ['Distraction Time', `${Math.round(totalDistractedMs / 60000)} minutes`],
        ['Focus Score', `${focusPercentage}%`],
        ['Total Distractions', totalDistractions.toString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
    });

    // Distraction Breakdown
    const finalY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 60) + 15;
    doc.text('Distraction Breakdown', 20, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Distraction Type', 'Frequency']],
      body: Object.entries(distractionCounts).length > 0
        ? Object.entries(distractionCounts).map(([type, count]) => [type, count.toString()])
        : [['No distractions recorded', '0']],
      theme: 'striped',
    });

    // Detailed Timeline
    doc.addPage();
    doc.text('Detailed Focus Timeline', 20, 20);
    
    const timelineData = logs.map(log => [
        new Date(log.time).toLocaleTimeString(),
        log.type,
        log.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Time', 'Event', 'Status']],
      body: timelineData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.save(`StudySync_Report_${new Date().getTime()}.pdf`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="stats-container"
      style={{
        background: 'var(--card-bg)',
        padding: '2.5rem',
        borderRadius: '24px',
        maxWidth: '800px',
        margin: '2rem auto',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        color: '#fff'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Trophy size={64} color="#facc15" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Focus Session Complete!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>You've made great progress today.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px', textAlign: 'center' }}>
          <Clock size={24} color="#6366f1" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ opacity: 0.6, fontSize: '0.875rem' }}>Duration</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalDurationMin}m</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px', textAlign: 'center' }}>
          <CheckCircle2 size={24} color="#22c55e" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ opacity: 0.6, fontSize: '0.875rem' }}>Focus Score</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 600, color: focusPercentage > 80 ? '#22c55e' : '#facc15' }}>{focusPercentage}%</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px', textAlign: 'center' }}>
          <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ opacity: 0.6, fontSize: '0.875rem' }}>Distractions</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalDistractions}</p>
        </div>
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Distraction Breakdown</h3>
        <div style={{ height: '300px', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
          {Object.keys(distractionCounts).length > 0 ? (
            <Bar 
                data={chartData} 
                options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    scales: { 
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
                        x: { grid: { display: false }, ticks: { color: '#fff' } }
                    },
                    plugins: { legend: { display: false } }
                }} 
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                No distractions recorded! Perfect session!
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button 
          onClick={downloadPDF}
          style={{ 
            flex: 1,
            padding: '1rem', 
            borderRadius: '12px', 
            background: 'var(--accent-color)', 
            color: '#fff', 
            border: 'none', 
            fontWeight: 600, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <Download size={20} />
          Export Detailed PDF Report
        </button>
        <button 
          onClick={onReset}
          style={{ 
            padding: '1rem 2rem', 
            borderRadius: '12px', 
            background: 'var(--glass-border)', 
            color: '#fff', 
            border: 'none', 
            fontWeight: 600, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <RefreshCcw size={20} />
          New Session
        </button>
      </div>
    </motion.div>
  );
};

export default SessionStats;
