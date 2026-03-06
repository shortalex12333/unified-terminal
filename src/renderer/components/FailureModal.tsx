import React, { useState, useEffect } from 'react';

interface FailureModalProps {
  planName: string;
  completedSteps: number;
  totalSteps: number;
  failedStep: number;
  failureReason: string;
  failureMessage: string;
  onResumeLater: () => void;
  onTryDifferent: () => void;
  onDownloadPartial: () => void;
  onClose: () => void;
}

export default function FailureModal({
  planName,
  completedSteps,
  totalSteps,
  failedStep,
  failureReason,
  failureMessage,
  onResumeLater,
  onTryDifferent,
  onDownloadPartial,
  onClose,
}: FailureModalProps): React.ReactElement {
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--kenoki-surface, #fff)',
        borderRadius: 'var(--kenoki-radius-lg, 16px)',
        padding: 32,
        maxWidth: 480,
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 24, color: 'var(--kenoki-text, #1d1d1f)' }}>
            We hit a wall
          </h2>
          <p style={{ margin: '8px 0 0', color: 'var(--kenoki-text-secondary, #666)', fontSize: 14 }}>
            But your progress is saved
          </p>
        </div>

        <div style={{
          background: 'var(--kenoki-bg, #f5f5f7)',
          borderRadius: 'var(--kenoki-radius-md, 12px)',
          padding: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--kenoki-text-secondary, #666)' }}>Progress</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{completedSteps} of {totalSteps} steps</span>
          </div>
          <div style={{
            height: 8,
            background: 'var(--kenoki-border, #e5e5e5)',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: progressPercent + '%',
              background: 'var(--kenoki-success, #34c759)',
              borderRadius: 4,
            }} />
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--kenoki-text-secondary, #666)' }}>
            <strong>Stopped at step {failedStep}:</strong> {failureMessage}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={onResumeLater} style={{
            padding: '14px 24px',
            background: 'var(--kenoki-primary, #007aff)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--kenoki-radius-pill, 999px)',
            fontSize: 16,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Resume Later
          </button>
          <button onClick={onTryDifferent} style={{
            padding: '14px 24px',
            background: 'var(--kenoki-surface-secondary, #f0f0f0)',
            color: 'var(--kenoki-text, #1d1d1f)',
            border: 'none',
            borderRadius: 'var(--kenoki-radius-pill, 999px)',
            fontSize: 16,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Try a Different Approach
          </button>
          <button onClick={onDownloadPartial} style={{
            padding: '14px 24px',
            background: 'transparent',
            color: 'var(--kenoki-primary, #007aff)',
            border: '1px solid var(--kenoki-primary, #007aff)',
            borderRadius: 'var(--kenoki-radius-pill, 999px)',
            fontSize: 16,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Download What's Done
          </button>
        </div>

        <button onClick={onClose} style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'none',
          border: 'none',
          fontSize: 24,
          cursor: 'pointer',
          color: 'var(--kenoki-text-secondary, #666)',
        }}>×</button>
      </div>
    </div>
  );
}
