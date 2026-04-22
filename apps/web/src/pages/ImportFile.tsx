import React, { useState, useRef, useEffect, Fragment } from 'react';
import axios from 'axios';
import {
    Upload, FileSearch, Layers, AlignLeft, Sparkles, FileSpreadsheet,
    Loader2, CheckCircle2, XCircle, Download, FileUp,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
type StageKey = 'upload' | 'classify' | 'extract' | 'parse' | 'categorize' | 'output';
type StageState = 'idle' | 'active' | 'completed' | 'failed';

interface Job {
    id: string;
    status: JobStatus;
    currentStage?: string;
    filename: string;
    bankType?: string;
    transactionCount?: number;
    pageCount?: number;
    error?: string;
}

// ── Pipeline stage definitions ───────────────────────────────────────────────

const STAGES: { key: StageKey; label: string; Icon: React.FC<{ size: number; color: string }> }[] = [
    { key: 'upload',     label: 'Upload',     Icon: Upload as any },
    { key: 'classify',   label: 'Classify',   Icon: FileSearch as any },
    { key: 'extract',    label: 'Extract',    Icon: Layers as any },
    { key: 'parse',      label: 'Parse',      Icon: AlignLeft as any },
    { key: 'categorize', label: 'Categorize', Icon: Sparkles as any },
    { key: 'output',     label: 'Output',     Icon: FileSpreadsheet as any },
];

const SERVER_STAGES: StageKey[] = ['classify', 'extract', 'parse', 'categorize', 'output'];

function computeStates(isUploading: boolean, job: Job | null): Record<StageKey, StageState> {
    const s: Record<StageKey, StageState> = {
        upload: 'idle', classify: 'idle', extract: 'idle',
        parse: 'idle', categorize: 'idle', output: 'idle',
    };

    if (isUploading) { s.upload = 'active'; return s; }
    if (!job) return s;

    s.upload = 'completed';

    if (job.status === 'completed') {
        SERVER_STAGES.forEach(k => { s[k] = 'completed'; });
        return s;
    }

    const currentIdx = job.currentStage
        ? Math.max(0, SERVER_STAGES.indexOf(job.currentStage as StageKey))
        : 0;

    SERVER_STAGES.forEach((k, i) => {
        if (job.status === 'failed') {
            s[k] = i < currentIdx ? 'completed' : i === currentIdx ? 'failed' : 'idle';
        } else {
            s[k] = i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'idle';
        }
    });

    return s;
}

// ── StageNode component ──────────────────────────────────────────────────────

interface StageNodeProps {
    stage: typeof STAGES[0];
    state: StageState;
    error?: string;
    isLast: boolean;
    lineCompleted: boolean;
}

function StageNode({ stage, state, error, isLast, lineCompleted }: StageNodeProps) {
    const [hovered, setHovered] = useState(false);
    const { Icon } = stage;

    const palette = {
        idle:      { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)',  icon: 'rgba(255,255,255,0.2)',  label: 'rgba(255,255,255,0.22)' },
        active:    { bg: 'rgba(99,102,241,0.14)',  border: '#6366f1',                icon: '#6366f1',                label: 'var(--text-muted)' },
        completed: { bg: 'rgba(34,197,94,0.1)',    border: '#22c55e',               icon: '#22c55e',                label: 'var(--text-muted)' },
        failed:    { bg: 'rgba(239,68,68,0.1)',    border: '#ef4444',               icon: '#ef4444',                label: '#ef4444' },
    }[state];

    const showTooltip = hovered && state === 'failed' && !!error;

    return (
        <Fragment>
            {/* Stage column */}
            <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 68, position: 'relative' }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Error tooltip */}
                {showTooltip && (
                    <div style={{
                        position: 'fixed',
                        bottom: 'auto',
                        top: 'auto',
                        left: '50%',
                        transform: 'translate(-50%, -8px)',
                        background: 'rgba(10,10,16,0.97)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        color: '#fca5a5',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.6rem',
                        fontSize: '0.82rem',
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        width: 'max-content',
                        maxWidth: '480px',
                        wordBreak: 'break-word',
                        zIndex: 9999,
                        pointerEvents: 'none',
                        textAlign: 'left',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(239,68,68,0.15)',
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: '#ef4444', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Processing error
                        </div>
                        {error}
                    </div>
                )}

                {/* Indicator row (28px tall) */}
                <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {state === 'active' && (
                        <Loader2 size={16} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                    )}
                    {state === 'completed' && <CheckCircle2 size={16} color="#22c55e" />}
                    {state === 'failed'    && <XCircle size={16} color="#ef4444" />}
                </div>

                {/* Circle */}
                <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: palette.bg,
                    border: `2px solid ${palette.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.4s ease',
                    boxShadow: state === 'active'
                        ? `0 0 0 4px ${palette.border}20, 0 0 16px ${palette.border}40`
                        : 'none',
                    cursor: state === 'failed' ? 'help' : 'default',
                }}>
                    <Icon size={20} color={palette.icon} />
                </div>

                {/* Label */}
                <span style={{
                    marginTop: '0.45rem',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    color: palette.label,
                    textAlign: 'center',
                    transition: 'color 0.4s',
                    textTransform: 'uppercase',
                }}>
                    {stage.label}
                </span>
            </div>

            {/* Connector line (shown between nodes, not after the last) */}
            {!isLast && (
                <div style={{
                    flex: 1,
                    height: 2,
                    minWidth: 12,
                    marginTop: 52,   // 28px indicator + 26px (half of 52px circle) - 1px (half line) = 53, minus 1 for visual tweak
                    background: lineCompleted
                        ? 'linear-gradient(90deg, #22c55e, #22c55e)'
                        : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.5s ease',
                    borderRadius: 1,
                }} />
            )}
        </Fragment>
    );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ImportFile() {
    const { t } = useLanguage();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [job, setJob] = useState<Job | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    const reset = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setJob(null);
        setUploadProgress(0);
        setUploadError(null);
    };

    const handleFileSelect = (file: File) => {
        reset();
        setSelectedFile(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const startPolling = (jobId: string) => {
        pollRef.current = setInterval(async () => {
            try {
                const res = await axios.get(`/v1/processing/${jobId}`);
                const j: Job = { id: jobId, ...res.data.job };
                setJob(j);
                if (j.status === 'completed' || j.status === 'failed') {
                    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                }
            } catch { /* ignore transient errors */ }
        }, 2000);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        reset();
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const res = await axios.post('/v1/users/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (e) => {
                    if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
                },
            });
            setUploadProgress(100);
            const jobId: string = res.data.jobId;
            setJob({ id: jobId, status: 'queued', filename: selectedFile.name });
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            startPolling(jobId);
        } catch (err: any) {
            setUploadError(err.response?.data?.error?.message || t.uploadFailed);
        } finally {
            setIsUploading(false);
        }
    };

    const stageStates = computeStates(isUploading, job);
    const isProcessing = job && (job.status === 'queued' || job.status === 'processing');
    const isCompleted  = job?.status === 'completed';
    const isFailed     = job?.status === 'failed';
    const canUpload    = !!selectedFile && !isUploading && !isProcessing;

    return (
        <div>
            <div style={{ marginBottom: '1.5rem' }}>
                <h2>{t.navImport}</h2>
            </div>

            <div className="card" style={{ maxWidth: 620 }}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '0.75rem',
                        background: 'rgba(99,102,241,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FileUp size={20} color="#6366f1" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>Bank Statement Processor</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Upload a PDF or Excel bank statement to extract and categorize transactions
                        </p>
                    </div>
                </div>

                {/* ── Pipeline visualization ── */}
                <div style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '1rem',
                    padding: '1.25rem 1rem 1rem',
                    marginBottom: '1.5rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                        {STAGES.map((stage, i) => (
                            <StageNode
                                key={stage.key}
                                stage={stage}
                                state={stageStates[stage.key]}
                                error={job?.error}
                                isLast={i === STAGES.length - 1}
                                lineCompleted={stageStates[stage.key] === 'completed'}
                            />
                        ))}
                    </div>

                    {/* Status label */}
                    <div style={{ marginTop: '1rem', textAlign: 'center', minHeight: 20 }}>
                        {!job && !isUploading && (
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>
                                Select a file below to begin
                            </span>
                        )}
                        {isUploading && (
                            <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>
                                Uploading… {uploadProgress}%
                            </span>
                        )}
                        {isProcessing && (
                            <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>
                                {job.bankType
                                    ? `Processing ${job.bankType.toUpperCase()} statement${job.pageCount ? ` · ${job.pageCount} pages` : ''}`
                                    : 'Processing…'}
                            </span>
                        )}
                        {isCompleted && (
                            <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                                ✓ Complete — {job.transactionCount} transactions extracted
                            </span>
                        )}
                        {isFailed && (
                            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                                {job.currentStage
                                    ? `Failed at the ${job.currentStage.charAt(0).toUpperCase() + job.currentStage.slice(1)} stage`
                                    : 'Processing failed'
                                } — hover the red icon for more details
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Drop zone ── */}
                {!isProcessing && !isCompleted && (
                    <div
                        className={`drop-zone${isDragging ? ' dragging' : ''}${selectedFile ? ' has-file' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                    >
                        <Upload size={26} style={{ marginBottom: '0.6rem', opacity: 0.5 }} />
                        {selectedFile
                            ? <p style={{ fontWeight: 600, color: 'var(--text)', margin: 0 }}>{selectedFile.name}</p>
                            : <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.88rem' }}>{t.dragDropFile}</p>
                        }
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.xlsx,.xls,.csv"
                            style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                        />
                    </div>
                )}

                {/* ── Upload progress bar ── */}
                {isUploading && (
                    <div style={{ marginTop: '1rem' }}>
                        <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                        </div>
                    </div>
                )}

                {/* ── Upload error (network/auth failures before job creation) ── */}
                {uploadError && (
                    <div style={{
                        marginTop: '1rem', padding: '0.75rem 1rem',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: '0.5rem', color: '#ef4444', fontSize: '0.85rem',
                    }}>
                        {uploadError}
                    </div>
                )}

                {/* ── Action buttons ── */}
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                    {(isCompleted || isFailed) && (
                        <button
                            className="btn-secondary"
                            onClick={() => { reset(); }}
                            style={{ flex: 1, justifyContent: 'center' }}
                        >
                            Upload another file
                        </button>
                    )}

                    {isCompleted && (
                        <button
                            className="btn-success"
                            onClick={async () => {
                                try {
                                    const res = await axios.get(`/v1/processing/${job!.id}/download`, { responseType: 'blob' });
                                    const url = URL.createObjectURL(res.data);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = job!.filename.replace(/\.[^.]+$/, '') + '_processed.xlsx';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                } catch {
                                    alert('Download failed. Please try again.');
                                }
                            }}
                            style={{ flex: 1, justifyContent: 'center' }}
                        >
                            <Download size={16} />
                            {t.download}
                        </button>
                    )}

                    {!isCompleted && !isFailed && (
                        <button
                            className="btn-primary"
                            onClick={handleUpload}
                            disabled={!canUpload}
                            style={{ flex: 1, justifyContent: 'center' }}
                        >
                            {isUploading
                                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {t.uploading}</>
                                : <><Upload size={16} /> {t.uploadFile}</>
                            }
                        </button>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .btn-primary, .btn-secondary, .btn-success {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.6rem 1.25rem; border: none; border-radius: 0.75rem;
          font-weight: 600; font-size: 0.88rem; cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
        }
        .btn-primary { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; }
        .btn-secondary { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: var(--text-muted); }
        .btn-success { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .btn-primary:hover, .btn-secondary:hover, .btn-success:hover { opacity: 0.85; }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

        .drop-zone {
          border: 2px dashed var(--glass-border); border-radius: 1rem;
          padding: 2rem 1.5rem;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          cursor: pointer; transition: border-color 0.2s, background 0.2s; text-align: center;
        }
        .drop-zone:hover, .drop-zone.dragging {
          border-color: var(--primary); background: rgba(99,102,241,0.05);
        }
        .drop-zone.has-file {
          border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.04);
        }

        .progress-track {
          width: 100%; height: 5px;
          background: rgba(255,255,255,0.07); border-radius: 99px; overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          border-radius: 99px; transition: width 0.2s ease;
        }
      `}</style>
        </div>
    );
}
