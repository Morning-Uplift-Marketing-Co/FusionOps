import React, { useState } from 'react';
import { THEME as T } from '../constants';
import changelogRaw from '../../CHANGELOG.md?raw';

export function ChangelogViewer() {
    const [isOpen, setIsOpen] = useState(false);

    // Simple markdown to HTML (enough for our basic CHANGELOG.md)
    const renderMarkdown = (text) => {
        let html = text
            // Headers
            .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mb-4">$1</h1>')
            .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-6 mb-2 text-[hsl(var(--primary))]">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 class="text-md font-medium mt-4 mb-2 text-[hsl(var(--foreground))]">$1</h3>')
            // Bold
            .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
            // Bullet points
            .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-sm text-[hsl(var(--muted-foreground))] mb-1">$1</li>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-[hsl(var(--primary))] hover:underline">$1</a>')
            // Newlines
            .replace(/\n$/gim, '<br />');

        return { __html: html };
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-[11px] px-2 py-1 bg-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded transition-colors"
                title="View Changelog"
            >
                Changelog {changelogRaw.match(/## \[(\d+\.\d+\.\d+)\]/)?.[1] || 'v2.2.0'}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-[hsl(var(--border))]">
                            <h2 className="font-bold text-lg m-0">System Updates</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="bg-transparent border-none text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer text-xl flex items-center justify-center w-8 h-8 rounded hover:bg-[hsl(var(--accent))]"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Body content */}
                        <div className="p-6 overflow-y-auto overflow-x-hidden text-[hsl(var(--foreground))] text-sm leading-relaxed" dangerouslySetInnerHTML={renderMarkdown(changelogRaw)} />
                    </div>
                </div>
            )}
        </>
    );
}
