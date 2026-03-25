import dynamic from 'next/dynamic';

const QuestDemoClient = dynamic(() => import('./QuestDemoClient'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0a1a 0%, #1a1025 50%, #0d0f1a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#a78bfa',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '1.125rem',
    }}>
      Loading Quest Demo...
    </div>
  ),
});

export default function QuestDemoPage() {
  return <QuestDemoClient />;
}
