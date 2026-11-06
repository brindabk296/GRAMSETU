import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Send,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  User,
  HeartPulse,
  Activity,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function DoctorChat() {
  const { user, isVerifiedDoctor } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize socket
  useEffect(() => {
    socketRef.current = io(window.location.origin, {
      auth: { token: localStorage.getItem('careroute_token') }
    });

    socketRef.current.on('new_message', (msg) => {
      setMessages((prev) => {
        // avoid duplicate if already in state
        if (prev.some(m => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      const token = localStorage.getItem('careroute_token');
      try {
        const res = await fetch('/api/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
          if (data.length > 0) {
            setSelectedConv(data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching conversations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  // When selected conversation changes, join socket room & fetch history
  useEffect(() => {
    if (!selectedConv) return;

    const token = localStorage.getItem('careroute_token');
    const convId = selectedConv.conversationId;

    if (socketRef.current) {
      socketRef.current.emit('join_conversation', convId);
    }

    fetch(`/api/chat/history/${convId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Error loading history:', err));

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_conversation', convId);
      }
    };
  }, [selectedConv]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv) return;

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
          conversationId: selectedConv.conversationId,
          message: newMessage.trim(),
          recipientId: selectedConv.patientId,
          recipientRole: 'patient'
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Socket also broadcasts, but update state optimistically
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

  // Anti-scam block if unverified
  if (!isVerifiedDoctor) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-rose-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Clinical Messaging Blocked (Anti-Scam Protection)
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Unverified doctor accounts cannot message patients or access sensitive medical discussions. This measure prevents impersonation and scam medical practitioners under rural safety protocols.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto h-[82vh] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Left: Patient Conversations Sidebar */}
        <div className="w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/60">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Patient Consultation Channels</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time doctor guidance & AI symptom triaging</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.map((conv) => {
              const active = selectedConv?.conversationId === conv.conversationId;
              return (
                <button
                  key={conv.conversationId}
                  type="button"
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full p-4 text-left transition-all flex items-start gap-3 ${
                    active ? 'bg-white border-l-4 border-emerald-600 shadow-xs' : 'hover:bg-slate-100/70'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs shrink-0">
                    {conv.patientName ? conv.patientName.charAt(0) : 'P'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {conv.patientName}
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                        {conv.village}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{conv.lastMessage}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Chat & AI Triager Screen */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                    {selectedConv.patientName ? selectedConv.patientName.charAt(0) : 'P'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{selectedConv.patientName}</h3>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                        {selectedConv.village} Village
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">
                      Live Clinical Consultation Channel • Dr. {user?.name} (Verified)
                    </span>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[11px] text-slate-400">Risk Tier: </span>
                  <span className="text-xs font-bold text-rose-600">{selectedConv.riskTier || 'Monitored'}</span>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No clinical messages yet. Patient inquiries and AI symptom summaries will appear here.
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isDoctor = m.senderRole === 'doctor';
                    const isAi = m.senderRole === 'ai_assistant';

                    if (isAi) {
                      return (
                        <div key={idx} className="max-w-xl mx-auto my-3 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 text-xs text-slate-800 space-y-1 shadow-xs animate-fadeIn">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <span>{m.senderName} (Auto-Triage Analysis)</span>
                            {m.healthContext?.urgencyLevel && (
                              <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ml-auto ${
                                m.healthContext.urgencyLevel === 'Emergency' ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-100 text-amber-900'
                              }`}>
                                {m.healthContext.urgencyLevel}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-700">{m.message}</p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-600">{m.senderName}</span>
                          <span>• {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isDoctor
                              ? 'bg-emerald-600 text-white rounded-br-none'
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

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type clinical advice, guidance, or treatment suggestion to patient..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Advice</span>
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Select a patient from the list on the left to review messages and provide guidance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
