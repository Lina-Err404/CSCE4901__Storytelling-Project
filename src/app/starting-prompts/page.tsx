'use client';
import React from 'react';
import Link from 'next/link';
// update this import path if components folder is located somewhere else (testing currently)
import StartingPrompt from '@/components/StartingPrompt';

export default function StartingPromptsPage() {
  return (
    <main style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <StartingPrompt />
      
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link 
          href="/teacher-review"
          style={{
            padding: '12px 24px',
            backgroundColor: '#4f46e5',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold'
          }}
        >
          Next: Teacher Review →
        </Link>
      </div>
    </main>
  );
}