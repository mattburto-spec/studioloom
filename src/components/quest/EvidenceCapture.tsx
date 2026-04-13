'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuestEvidence, QuestMilestone, EvidenceType } from '@/lib/quest/types';
import { checkClientSide, MODERATION_MESSAGES, detectLanguage } from '@/lib/content-safety/client-filter';

interface EvidenceCaptureProps {
  journeyId: string;
  milestones: QuestMilestone[];
  recentEvidence: QuestEvidence[];
  mentorColor?: string;
  onEvidenceSubmitted?: (evidence: QuestEvidence) => void;
}

const EVIDENCE_TYPES: Array<{
  type: EvidenceType;
  label: string;
  icon: string;
  description: string;
  accepts?: string;
}> = [
  { type: 'photo', label: 'Photo', icon: '📸', description: 'Photo or screenshot', accepts: 'image/*' },
  { type: 'voice', label: 'Voice', icon: '🎤', description: 'Audio recording', accepts: 'audio/*' },
  { type: 'text', label: 'Text', icon: '✏️', description: 'Written description' },
  { type: 'file', label: 'File', icon: '📎', description: 'Document or resource' },
  { type: 'link', label: 'Link', icon: '🔗', description: 'URL to resource' },
  { type: 'reflection', label: 'Reflection', icon: '💭', description: 'Learning reflection' },
];

function countMeaningfulWords(text: string): number {
  const fillerWords = new Set([
    'i', 'the', 'a', 'an', 'is', 'was', 'it', 'my', 'to', 'and', 'or', 'of',
    'in', 'for', 'that', 'this', 'with', 'be', 'are', 'am', 'you', 'he', 'she',
    'we', 'they', 'them', 'as', 'at', 'by', 'from', 'on', 'but',
  ]);
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  return words.filter(w => !fillerWords.has(w)).length;
}

function getEffortBadge(wordCount: number): { label: string; color: string; emoji: string } {
  if (wordCount < 5) return { label: 'Keep going', color: '#F59E0B', emoji: '🌱' };
  if (wordCount < 15) return { label: 'Good detail', color: '#10B981', emoji: '✨' };
  return { label: 'Excellent depth', color: '#8B5CF6', emoji: '🚀' };
}

export function EvidenceCapture({
  journeyId,
  milestones,
  recentEvidence,
  mentorColor = '#A78BFA',
  onEvidenceSubmitted,
}: EvidenceCaptureProps) {
  const [selectedType, setSelectedType] = useState<EvidenceType>('text');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMilestones = milestones.filter(m => m.status === 'active' || m.status === 'upcoming');

  // Text/reflection specific calculations
  const meaningfulWordCount = selectedType === 'text' || selectedType === 'reflection'
    ? countMeaningfulWords(content)
    : 0;
  const effortBadge = getEffortBadge(meaningfulWordCount);
  const isValidUrl = url ? (url.startsWith('http://') || url.startsWith('https://')) : false;

  // Form validation
  const canSubmit = (): boolean => {
    switch (selectedType) {
      case 'text':
      case 'reflection':
        return content.trim().length > 0;
      case 'link':
        return isValidUrl;
      case 'photo':
      case 'voice':
      case 'file':
        return fileName.length > 0;
      default:
        return false;
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (['photo', 'voice', 'file'].includes(selectedType)) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    setFileName(file.name);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }

    // For now, just store the filename. Real upload would go through Supabase storage.
    setContent(file.name);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleTypeChange = (newType: EvidenceType) => {
    setSelectedType(newType);
    setContent('');
    setFileName('');
    setFilePreview(null);
    setUrl('');
  };

  const handleSubmit = useCallback(async () => {
    if (!canSubmit()) return;

    // Content safety check for text/reflection types
    if ((selectedType === 'text' || selectedType === 'reflection') && content.trim()) {
      const moderationCheck = checkClientSide(content);
      if (!moderationCheck.ok) {
        const lang = detectLanguage(content);
        setModerationError(MODERATION_MESSAGES[lang === 'zh' ? 'zh' : 'en']);
        fetch('/api/safety/log-client-block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'quest_evidence',
            flags: moderationCheck.flags,
            snippet: content.slice(0, 200),
          }),
        }).catch(() => {});
        return;
      }
    }
    setModerationError(null);

    setIsSubmitting(true);
    try {
      const evidencePayload = {
        journeyId,
        milestoneId: selectedMilestoneId || null,
        type: selectedType,
        content: content || null,
        fileUrl: filePreview || null,
        fileType: selectedType === 'photo' ? 'image' : selectedType === 'voice' ? 'audio' : selectedType,
      };

      const res = await fetch('/api/student/quest/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evidencePayload),
      });

      if (!res.ok) throw new Error('Failed to submit evidence');

      const evidence = await res.json();
      onEvidenceSubmitted?.(evidence);

      // Reset form
      setContent('');
      setFileName('');
      setFilePreview(null);
      setUrl('');
      setSelectedMilestoneId(null);
      setSelectedType('text');

      // Show success feedback
      const successElement = document.createElement('div');
      successElement.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${mentorColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        animation: slideIn 0.3s ease;
      `;
      successElement.textContent = '✓ Evidence submitted!';
      document.body.appendChild(successElement);
      setTimeout(() => successElement.remove(), 3000);
    } catch (err) {
      console.error('Evidence submission failed:', err);
      alert('Failed to submit evidence. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [journeyId, selectedType, content, selectedMilestoneId, filePreview, onEvidenceSubmitted, mentorColor]);

  const dragZoneAccepts = selectedType === 'photo' ? 'image/*' : selectedType === 'voice' ? 'audio/*' : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        backgroundColor: '#0f172a',
        border: `1px solid #1e293b`,
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
      }}
    >
      {/* Type Selector Bar */}
      <motion.div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {EVIDENCE_TYPES.map((typeOption) => (
          <motion.button
            key={typeOption.type}
            onClick={() => handleTypeChange(typeOption.type)}
            whileHover={{ scale: 1.05 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: selectedType === typeOption.type ? mentorColor : '#1e293b',
              color: '#ffffff',
              fontWeight: selectedType === typeOption.type ? '600' : '500',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span>{typeOption.icon}</span>
            <span>{typeOption.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Content Input Area */}
      <AnimatePresence mode="wait">
        {selectedType === 'text' || selectedType === 'reflection' ? (
          <motion.div
            key="text-input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
              {selectedType === 'reflection' ? 'What did you learn?' : 'What did you do?'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                selectedType === 'reflection'
                  ? 'What did you learn? What would you do differently? What surprised you?'
                  : 'Describe what you did, what you discovered, or what you created...'
              }
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                backgroundColor: '#1e293b',
                border: `1px solid #374151`,
                borderRadius: '8px',
                color: '#ffffff',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {meaningfulWordCount} meaningful words
              </span>
              {content.trim().length > 0 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: effortBadge.color,
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                  }}
                >
                  <span>{effortBadge.emoji}</span>
                  <span>{effortBadge.label}</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : selectedType === 'photo' || selectedType === 'voice' || selectedType === 'file' ? (
          <motion.div
            key="drag-drop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragActive ? mentorColor : '#374151'}`,
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center',
              backgroundColor: dragActive ? `${mentorColor}15` : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={dragZoneAccepts}
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <motion.div onClick={() => fileInputRef.current?.click()}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                {selectedType === 'photo' ? '📸' : selectedType === 'voice' ? '🎤' : '📎'}
              </div>
              <div style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '4px' }}>
                Drop {selectedType === 'photo' ? 'photo' : selectedType === 'voice' ? 'audio' : 'file'} here or click to browse
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {selectedType === 'photo' ? 'PNG, JPG, WebP' : selectedType === 'voice' ? 'MP3, WAV, M4A' : 'PDF, DOCX, etc'}
              </div>
            </motion.div>

            {/* File Preview */}
            {filePreview && selectedType === 'photo' && (
              <motion.img
                src={filePreview}
                alt="Preview"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  marginTop: '16px',
                  maxHeight: '200px',
                  maxWidth: '100%',
                  borderRadius: '8px',
                  border: `1px solid ${mentorColor}`,
                }}
              />
            )}

            {/* File Name Display */}
            {fileName && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  wordBreak: 'break-all',
                }}
              >
                {fileName}
              </motion.div>
            )}
          </motion.div>
        ) : selectedType === 'link' ? (
          <motion.div
            key="link-input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
              Resource URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#1e293b',
                border: `1px solid ${isValidUrl ? mentorColor : '#374151'}`,
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
              }}
            />
            {url && !isValidUrl && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#ef4444' }}>
                ✗ URL must start with http:// or https://
              </div>
            )}
            {isValidUrl && url && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  borderLeft: `3px solid ${mentorColor}`,
                }}
              >
                🔗 {new URL(url).hostname}
              </motion.div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Milestone Linker */}
      <motion.div style={{ marginTop: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
          Link to milestone (optional)
        </label>
        <select
          value={selectedMilestoneId || ''}
          onChange={(e) => setSelectedMilestoneId(e.target.value || null)}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: '#1e293b',
            border: `1px solid #374151`,
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <option value="">No milestone — general evidence</option>
          {activeMilestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        {selectedMilestoneId && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              marginTop: '8px',
              display: 'inline-block',
              padding: '6px 12px',
              backgroundColor: mentorColor,
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            ✓ Linked
          </motion.div>
        )}
      </motion.div>

      {/* Moderation error */}
      {moderationError && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', fontSize: '14px' }}>
          {moderationError}
        </div>
      )}

      {/* Submit Button */}
      <motion.button
        onClick={handleSubmit}
        disabled={!canSubmit() || isSubmitting}
        whileHover={canSubmit() ? { scale: 1.02 } : {}}
        whileTap={canSubmit() ? { scale: 0.98 } : {}}
        style={{
          marginTop: '24px',
          width: '100%',
          padding: '12px 20px',
          backgroundColor: canSubmit() ? mentorColor : '#374151',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '14px',
          cursor: canSubmit() ? 'pointer' : 'not-allowed',
          opacity: canSubmit() ? 1 : 0.5,
          transition: 'all 0.2s ease',
        }}
      >
        {isSubmitting ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }}
            />
            Submitting...
          </span>
        ) : (
          'Submit Evidence'
        )}
      </motion.button>

      {/* Recent Evidence Strip */}
      {recentEvidence.length > 0 && (
        <motion.div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #1e293b' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', fontWeight: '500' }}>
            Recent Evidence
          </div>
          <motion.div
            style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}
          >
            {recentEvidence.slice(0, 5).map((evidence) => (
              <motion.div
                key={evidence.id}
                title={evidence.teacher_feedback || 'Pending teacher review'}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '8px',
                  backgroundColor: '#1e293b',
                  border: `2px solid ${evidence.approved_by_teacher ? '#10B981' : '#64748b'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  flexShrink: 0,
                  cursor: 'pointer',
                  position: 'relative',
                }}
                whileHover={{ scale: 1.05 }}
              >
                <div style={{ fontSize: '20px' }}>
                  {evidence.type === 'photo' ? '📸' : evidence.type === 'voice' ? '🎤' : evidence.type === 'text' ? '✏️' : evidence.type === 'file' ? '📎' : evidence.type === 'link' ? '🔗' : evidence.type === 'reflection' ? '💭' : '📝'}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                  {new Date(evidence.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                {evidence.approved_by_teacher && (
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'white',
                    }}
                  >
                    ✓
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
}

export default EvidenceCapture;
