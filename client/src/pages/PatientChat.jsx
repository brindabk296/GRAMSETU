import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Send,
  Sparkles,
  ShieldCheck,
  HeartPulse,
  AlertTriangle,
  Stethoscope,
  Clock,
  HelpCircle
} from 'lucide-react';

export default function PatientChat() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Unified conversation ID for this patient
  const patientId = profile?._id || user?.id;
  // Pre-configured channel linking to Dr. Ravi Kumar
  const conversationId = `conv_${patientId}_${profile?.assignedDoctorId || 'doc'}`;

  // Socket setup
  useEffect(() => {
    socketRef.current = io(window.location.origin, {
      auth: { token: localStorage.getItem('careroute_token') }
    });
    socketRef.current.emit('join_conversation', conversationId);

    socketRef.current.on('new_message', (msg) => {
      setMessages((prev) => {
        if (prev.some(m => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [conversationId]);

  // Load chat history
  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('careroute_token');
      try {
        const res = await fetch(`/api/chat/history/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [conversationId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    const token = localStorage.getItem('careroute_token');

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId,
          message: newMessage.trim(),
          recipientRole: 'doctor'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m._id)));
          const uniqueNew = data.sentMessages.filter(m => !existingIds.has(String(m._id)));
          return [...prev, ...uniqueNew];
        });
        setNewMessage('');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to send message.');
      }
    } catch (err) {
      alert('Error sending message.');
    } finally {
      setSending(false);
    }
  };

  const sendQuickSymptom = (text) => {
    setNewMessage(text);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto h-[82vh] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-emerald-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Dr. Ravi Kumar (MBBS, MD)
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Verified Field Doctor</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                AI Clinical Guard + Traveling Doctor Communication Channel
              </p>
            </div>
          </div>

          <div className="hidden sm:block text-right">
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
              Active in {profile?.village || 'Angara'} Circuit
            </span>
          </div>
        </div>

        {/* Quick Symptom Helpers */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold text-slate-400">Quick Symptoms:</span>
          <button
            onClick={() => sendQuickSymptom("Namaste Doctor Sahab, I have had a severe headache and dizziness since morning.")}
            className="px-2.5 py-1 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 rounded-lg border border-slate-200 text-[11px] transition-colors"
          >
            "Headache & Dizziness"
          </button>
          <button
            onClick={() => sendQuickSymptom("Doctor, I missed taking my sugar tablets for 2 days. What should I do?")}
            className="px-2.5 py-1 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 rounded-lg border border-slate-200 text-[11px] transition-colors"
          >
            "Missed Medication"
          </button>
          <button
            onClick={() => sendQuickSymptom("My feet feel swollen and I feel tired after walking a few steps.")}
            className="px-2.5 py-1 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 rounded-lg border border-slate-200 text-[11px] transition-colors"
          >
            "Swelling & Fatigue"
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/40">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Loading clinical messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
              <Sparkles className="w-8 h-8 text-teal-500 animate-pulse" />
              <span>Describe your symptoms or ask a question to Dr. Ravi and the CareRoute AI Assistant.</span>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMe = m.senderRole === 'patient';
              const isAi = m.senderRole === 'ai_assistant';

              if (isAi) {
                return (
                  <div key={idx} className="max-w-xl mx-auto my-3 p-4 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border border-teal-200 text-xs text-slate-800 space-y-1.5 shadow-xs animate-fadeIn">
                    <div className="flex items-center gap-1.5 font-bold text-teal-950">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span>CareRoute AI Health Assistant</span>
                      {m.healthContext?.urgencyLevel && (
                        <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ml-auto ${
                          m.healthContext.urgencyLevel === 'Emergency' ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {m.healthContext.urgencyLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-700">{m.message}</p>
                    <div className="text-[10px] text-teal-700/80 pt-1">
                      *Initial triage guidance. Your verified doctor Dr. Ravi has also received this notification.
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold text-slate-600">{m.senderName}</span>
                    <span>• {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div
                    className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isMe
                        ? 'bg-teal-700 text-white rounded-br-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Describe your health problem, symptom, or question to Dr. Ravi..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 transition-all"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
