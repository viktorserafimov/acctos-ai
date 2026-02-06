import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, MessageSquare, Clock, AlertCircle, ChevronRight, Send } from 'lucide-react';

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    _count?: { messages: number };
    messages?: TicketMessage[];
}

interface TicketMessage {
    id: string;
    content: string;
    createdAt: string;
    author?: { name?: string; email: string };
}

export default function Tickets() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [showNewTicket, setShowNewTicket] = useState(false);
    const [loading, setLoading] = useState(true);

    // New ticket form
    const [newSubject, setNewSubject] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [newPriority, setNewPriority] = useState('normal');

    // Reply form
    const [replyContent, setReplyContent] = useState('');
    const [sending, setSending] = useState(false);

    const fetchTickets = async () => {
        try {
            const response = await axios.get('/v1/tickets');
            setTickets(response.data.tickets);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTicketDetail = async (ticketId: string) => {
        try {
            const response = await axios.get(`/v1/tickets/${ticketId}`);
            setSelectedTicket(response.data);
        } catch (error) {
            console.error('Failed to fetch ticket:', error);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    useEffect(() => {
        if (id) {
            fetchTicketDetail(id);
        } else {
            setSelectedTicket(null);
        }
    }, [id]);

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        try {
            const response = await axios.post('/v1/tickets', {
                subject: newSubject,
                message: newMessage,
                priority: newPriority,
            });
            await fetchTickets();
            setShowNewTicket(false);
            setNewSubject('');
            setNewMessage('');
            setNewPriority('normal');
            navigate(`/tickets/${response.data.id}`);
        } catch (error) {
            console.error('Failed to create ticket:', error);
        } finally {
            setSending(false);
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket || !replyContent.trim()) return;

        setSending(true);
        try {
            await axios.post(`/v1/tickets/${selectedTicket.id}/messages`, {
                content: replyContent,
            });
            await fetchTicketDetail(selectedTicket.id);
            setReplyContent('');
        } catch (error) {
            console.error('Failed to send reply:', error);
        } finally {
            setSending(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return '#3b82f6';
            case 'in_progress': return '#f59e0b';
            case 'waiting': return '#8b5cf6';
            case 'resolved': return '#10b981';
            case 'closed': return '#6b7280';
            default: return '#6b7280';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return '#ef4444';
            case 'high': return '#f59e0b';
            case 'normal': return '#3b82f6';
            case 'low': return '#6b7280';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="tickets-page">
            <div className="page-header">
                <div>
                    <h2>Support Tickets</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Get help from our support team
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setShowNewTicket(true)}>
                    <Plus size={16} />
                    New Ticket
                </button>
            </div>

            <div className="tickets-layout">
                {/* Ticket List */}
                <div className="ticket-list">
                    {tickets.length === 0 ? (
                        <div className="empty-state">
                            <MessageSquare size={48} color="var(--text-muted)" />
                            <p>No tickets yet</p>
                            <button className="btn-secondary" onClick={() => setShowNewTicket(true)}>
                                Create your first ticket
                            </button>
                        </div>
                    ) : (
                        tickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                className={`ticket-item ${selectedTicket?.id === ticket.id ? 'active' : ''}`}
                                onClick={() => navigate(`/tickets/${ticket.id}`)}
                            >
                                <div className="ticket-item-header">
                                    <span className="ticket-subject">{ticket.subject}</span>
                                    <ChevronRight size={16} />
                                </div>
                                <div className="ticket-meta">
                                    <span className="status-badge" style={{ background: `${getStatusColor(ticket.status)}20`, color: getStatusColor(ticket.status) }}>
                                        {ticket.status.replace('_', ' ')}
                                    </span>
                                    <span className="priority-badge" style={{ color: getPriorityColor(ticket.priority) }}>
                                        <AlertCircle size={12} />
                                        {ticket.priority}
                                    </span>
                                    <span className="ticket-date">
                                        <Clock size={12} />
                                        {new Date(ticket.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Ticket Detail */}
                <div className="ticket-detail">
                    {selectedTicket ? (
                        <>
                            <div className="ticket-detail-header">
                                <h3>{selectedTicket.subject}</h3>
                                <div className="ticket-detail-meta">
                                    <span className="status-badge" style={{ background: `${getStatusColor(selectedTicket.status)}20`, color: getStatusColor(selectedTicket.status) }}>
                                        {selectedTicket.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            <div className="messages-container">
                                {selectedTicket.messages?.map((message) => (
                                    <div key={message.id} className="message">
                                        <div className="message-header">
                                            <span className="message-author">{message.author?.name || message.author?.email}</span>
                                            <span className="message-date">{new Date(message.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div className="message-content">{message.content}</div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleSendReply} className="reply-form">
                                <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Type your reply..."
                                    rows={3}
                                />
                                <button type="submit" className="btn-primary" disabled={sending || !replyContent.trim()}>
                                    <Send size={16} />
                                    {sending ? 'Sending...' : 'Send Reply'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="empty-state">
                            <MessageSquare size={48} color="var(--text-muted)" />
                            <p>Select a ticket to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* New Ticket Modal */}
            {showNewTicket && (
                <div className="modal-overlay" onClick={() => setShowNewTicket(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Create New Ticket</h3>
                        <form onSubmit={handleCreateTicket}>
                            <div className="input-group">
                                <label>Subject</label>
                                <input
                                    type="text"
                                    value={newSubject}
                                    onChange={(e) => setNewSubject(e.target.value)}
                                    placeholder="Brief description of your issue"
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label>Priority</label>
                                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Message</label>
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Describe your issue in detail..."
                                    rows={5}
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowNewTicket(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={sending}>
                                    {sending ? 'Creating...' : 'Create Ticket'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .tickets-page {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.25rem;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border: none;
          border-radius: 0.75rem;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-secondary {
          padding: 0.6rem 1.25rem;
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          color: var(--text);
          cursor: pointer;
        }
        .tickets-layout {
          flex: 1;
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 1.5rem;
          min-height: 0;
        }
        .ticket-list {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1rem;
          overflow-y: auto;
        }
        .ticket-item {
          padding: 1rem;
          border-bottom: 1px solid var(--glass-border);
          cursor: pointer;
          transition: background 0.2s;
        }
        .ticket-item:hover, .ticket-item.active {
          background: rgba(255, 255, 255, 0.05);
        }
        .ticket-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .ticket-subject {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ticket-meta {
          display: flex;
          gap: 0.75rem;
          font-size: 0.8rem;
        }
        .status-badge {
          padding: 0.15rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          text-transform: capitalize;
        }
        .priority-badge, .ticket-date {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--text-muted);
        }
        .ticket-detail {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .ticket-detail-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--glass-border);
        }
        .ticket-detail-header h3 {
          margin-bottom: 0.5rem;
        }
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }
        .message {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 0.75rem;
        }
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
        }
        .message-author {
          font-weight: 600;
          color: var(--primary);
        }
        .message-date {
          color: var(--text-muted);
        }
        .message-content {
          white-space: pre-wrap;
          line-height: 1.6;
        }
        .reply-form {
          padding: 1rem;
          border-top: 1px solid var(--glass-border);
          display: flex;
          gap: 1rem;
        }
        .reply-form textarea {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          padding: 0.75rem;
          color: var(--text);
          resize: none;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: var(--text-muted);
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .modal-content {
          background: var(--surface);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 2rem;
          width: 100%;
          max-width: 500px;
        }
        .modal-content h3 {
          margin-bottom: 1.5rem;
        }
        .input-group {
          margin-bottom: 1rem;
        }
        .input-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .input-group input, .input-group select, .input-group textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          padding: 0.75rem;
          color: var(--text);
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 1.5rem;
        }
      `}</style>
        </div>
    );
}
