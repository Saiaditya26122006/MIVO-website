'use client';

// Placeholder for 3D model viewer component
export function ModelViewer({ modelUrl, className }: { modelUrl?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-ink/5 rounded-xl ${className || 'w-full h-full'}`}>
      <div className="text-center text-ink/60">
        <div className="text-6xl mb-4">📦</div>
        <p className="text-sm">3D Model Viewer</p>
        {modelUrl && <p className="text-xs mt-2 opacity-50">{modelUrl}</p>}
      </div>
    </div>
  );
}
