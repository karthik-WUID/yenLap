import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'YenLap — Keep the memories. Give it another life.', description: 'Restore old laptops, reconnect with your memories, and give technology a second life.' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }
