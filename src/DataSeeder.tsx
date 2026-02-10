
import { useState } from 'react';
import { Cr76d_ticketsService } from './generated/services/Cr76d_ticketsService';

const BATCH_SIZE = 10;
const TOTAL_RECORDS = 10000;

export const DataSeeder = ({ currentUserEmail }: { currentUserEmail: string }) => {
    const [progress, setProgress] = useState(0);
    const [isSeeding, setIsSeeding] = useState(false);
    const [status, setStatus] = useState('');
    const [errorCount, setErrorCount] = useState(0);
    const [lastError, setLastError] = useState<string>('');

    const generateRandomTicket = (index: number) => {
        const priorities = [376340000, 376340001, 376340002]; // Low, Medium, High
        const statuses = [376340000, 376340001, 376340002]; // Open, In Progress, Closed

        const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        const issues = ['Login Failure', 'VPN Connection', 'Outlook Crash', 'Printer Jam', 'Software Update', 'Blue Screen', 'Slow Performance', 'Password Reset', 'New Hardware Request', 'Network Error'];
        const randomIssue = issues[Math.floor(Math.random() * issues.length)];

        return {
            cr76d_tickettitle: `[Auto-Gen] ${randomIssue} - #${index}`,
            cr76d_description: `Auto-generated #${index} for testing.`,
            cr76d_priority: randomPriority,
            cr76d_status: randomStatus,
            cr76d_ticketowner: currentUserEmail
        };
    };

    const startSeeding = async () => {
        if (!confirm(`This will create ${TOTAL_RECORDS} records in Dataverse. Are you sure?`)) return;

        setIsSeeding(true);
        setProgress(0);
        setErrorCount(0);
        setStatus('Starting generation...');

        let created = 0;

        // Process in chunks
        for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
            const batchPromises = [];
            const end = Math.min(i + BATCH_SIZE, TOTAL_RECORDS);

            for (let j = i; j < end; j++) {
                const payload = generateRandomTicket(j + 1);
                // Using 'as any' to match the pattern in App.tsx for system field avoidance
                batchPromises.push(
                    Cr76d_ticketsService.create(payload as any)
                        .then(res => {
                            if (!res.success) {
                                throw new Error(res.error?.message || 'Unknown error');
                            }
                            return res;
                        })
                        .catch(err => {
                            console.error('Failed to create record', err);
                            setLastError(err.message || JSON.stringify(err));
                            setErrorCount(prev => prev + 1);
                            return null;
                        })
                );
            }

            await Promise.all(batchPromises);
            created += (end - i);
            setProgress(created);
            setStatus(`Generated ${created} / ${TOTAL_RECORDS} records...`);

            // Small delay to be nice to the API limits
            await new Promise(r => setTimeout(r, 50));
        }

        setIsSeeding(false);
        setStatus(`Completed! Created ${created} records. Errors: ${errorCount}`);
    };

    return (
        <div className="card" style={{ marginTop: '2rem', border: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-bold">Data Seeding (Dev Tool)</h3>
            <p className="text-secondary" style={{ marginBottom: '1rem' }}>
                Use this tool to populate the database with {TOTAL_RECORDS} dummy records for testing delegations and performance.
            </p>

            {!isSeeding ? (
                <button className="btn" onClick={startSeeding} style={{ backgroundColor: 'var(--warning-color)' }}>
                    Start Data Generation ({TOTAL_RECORDS})
                </button>
            ) : (
                <div>
                    <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{status}</div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                            style={{
                                width: `${(progress / TOTAL_RECORDS) * 100}%`,
                                height: '100%',
                                backgroundColor: 'var(--primary-color)',
                                transition: 'width 0.2s'
                            }}
                        />
                    </div>
                    {errorCount > 0 && (
                        <div style={{ color: 'red', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            Errors: {errorCount} <br />
                            Last Error: {lastError}
                        </div>
                    )}
                    <p className="text-sm text-secondary" style={{ marginTop: '0.5rem' }}>
                        Please do not close this tab.
                    </p>
                </div>
            )}
        </div>
    );
};
