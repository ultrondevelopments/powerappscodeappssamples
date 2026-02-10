import { useEffect, useState, useRef } from 'react';
import './App.css';
import { Cr76d_ticketsService } from './generated/services/Cr76d_ticketsService';
import type { Cr76d_tickets } from './generated/models/Cr76d_ticketsModel'; // Type-only import
import { Office365UsersService } from './generated/services/Office365UsersService';
import { DataSeeder } from './DataSeeder';
import type { User } from './generated/models/Office365UsersModel'; // Type-only import

type View = 'all' | 'my' | 'settings' | 'contact_us';

const PRIORITY_OPTIONS = [
  { value: 376340000, label: 'Low' },
  { value: 376340001, label: 'Medium' },
  { value: 376340002, label: 'High' }
];

const STATUS_OPTIONS = [
  { value: 376340000, label: 'Open' },
  { value: 376340001, label: 'In Progress' },
  { value: 376340002, label: 'Closed' }
];

const App = () => {
  const [view, setView] = useState<View>('all');
  const [tickets, setTickets] = useState<Cr76d_tickets[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<number | undefined>(undefined);
  const searchTimeout = useRef<any>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageTokens, setPageTokens] = useState<string[]>([]);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const PAGE_SIZE = 50;


  // Modal / Editing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Partial<Cr76d_tickets> | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Load current user
    const loadUser = async () => {
      try {
        const result = await Office365UsersService.MyProfile_V2();
        if (result.data && result.data.mail) {
          setCurrentUserEmail(result.data.mail);
        }
      } catch (e) {
        console.error("Failed to load user profile", e);
      }
    };
    loadUser();

    // Check saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  useEffect(() => {
    if (view === 'all' || view === 'my') {
      loadTickets();
    }
  }, [view, statusFilter, priorityFilter, page]);

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (view === 'all' || view === 'my') {
        if (page !== 1) {
          setPage(1);
          setPageTokens([]);
        }
        else loadTickets();
      }
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const loadTickets = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const filters: string[] = [];

      // View Filter
      if (view === 'my') {
        filters.push(`cr76d_ticketowner eq '${currentUserEmail}'`);
      }

      // Search Filter (Title contains term)
      if (searchTerm) {
        filters.push(`contains(cr76d_tickettitle, '${searchTerm}')`);
      }

      // Dropdown Filters
      if (statusFilter !== undefined) {
        filters.push(`cr76d_status eq ${statusFilter}`);
      }
      if (priorityFilter !== undefined) {
        filters.push(`cr76d_priority eq ${priorityFilter}`);
      }

      const filterString = filters.length > 0 ? filters.join(' and ') : undefined;
      console.log(`Loading tickets (Page ${page})... Filters:`, filterString);


      // We explicitly request top 50 for now, but in a real delegated scenario we might want more.
      // However, to show delegation works, we can just rely on the default behavior or request a page.
      // Use maxPageSize AND top to cover all bases for pagination limits
      const currentToken = page > 1 ? pageTokens[page - 2] : undefined;

      const response = await Cr76d_ticketsService.getAll({
        filter: filterString,
        maxPageSize: PAGE_SIZE,
        skipToken: currentToken,
        orderBy: ['createdon desc']
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Unknown error fetching tickets');
      }

      setTickets(response.data || []);

      // Capture next link for pagination
      const resAny = response as any;
      let token = null;

      // FIRST: Check for direct skipToken property (as seen in debug)
      if (resAny.skipToken) {
        token = resAny.skipToken;
      }
      else {
        const nextLinkUrl = resAny.nextLink || resAny['@odata.nextLink'] || resAny.oDataNextLink || resAny['@microsoft.powerapps.data.nextLink'];

        if (nextLinkUrl) {
          try {
            // REGEX Extraction to keep it encoded (assuming API wants it that way or we decode it if needed)
            // Usually nextLink has it encoded. 
            // If we use URL.searchParams, it decodes it. 
            // Regex keeps it as is (percent encoded).
            const match = nextLinkUrl.match(/[?&](?:%24|\$)skiptoken=([^&]+)/i);
            if (match) {
              token = match[1];
              // Note: We might need to decodeComponent here IF the API expects decoded. 
              // But often passing the raw string from nextLink is safer if we manually construct the next query string?
              // Actually, if we pass it to options.skipToken, the interface might encode it AGAIN. 
              // Let's try DECODING it (back to XML/String) because the library likely encodes parameters.
              token = decodeURIComponent(token);
            }
            else {
              // Fallback
              const urlStr = nextLinkUrl.startsWith('http') ? nextLinkUrl : (window.location.origin + (nextLinkUrl.startsWith('/') ? '' : '/') + nextLinkUrl);
              const url = new URL(urlStr);
              token = url.searchParams.get('$skiptoken') || url.searchParams.get('skiptoken');
            }
          } catch (e) {
            console.error("Failed to parse nextLink", nextLinkUrl, e);
          }
        }
      }

      setNextLink(token);

    } catch (error: any) {
      console.error("Failed to load tickets", error);
      setFetchError(error.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTicket = async () => {
    if (!editingTicket) return;

    setLoading(true);
    try {
      // Define payload with ONLY allowed fields
      const ticketPayload = {
        cr76d_tickettitle: editingTicket.cr76d_tickettitle,
        cr76d_description: editingTicket.cr76d_description,
        cr76d_priority: editingTicket.cr76d_priority,
        cr76d_status: editingTicket.cr76d_status,
        cr76d_ticketowner: editingTicket.cr76d_ticketowner,
      };

      // Ensure mandatory fields (Tickettitle)
      if (!ticketPayload.cr76d_tickettitle) {
        alert("Title is required");
        setLoading(false);
        return;
      }

      if (editingTicket.cr76d_ticketid) {
        // Update
        const response = await Cr76d_ticketsService.update(editingTicket.cr76d_ticketid, ticketPayload);
        if (!response.success && response.error) {
          throw response.error;
        }
      } else {
        // Create
        // Cast to any to bypass mandatory system fields (ownerid, statecode) which we must not send
        const response = await Cr76d_ticketsService.create(ticketPayload as any);
        if (!response.success && response.error) {
          throw response.error;
        }
      }
      setIsModalOpen(false);
      setEditingTicket(null);
      loadTickets();
    } catch (error) {
      console.error("Failed to save ticket", error);
      alert("Failed to save ticket.");
    } finally {
      setLoading(false);
    }
  };

  // Removed client-side filtering since we are now filtering on server
  const filteredTickets = tickets;

  const handleNavClick = (v: View) => {
    setView(v);
    setMobileMenuOpen(false);
  };

  // Icons (Simple SVGs)
  const IconDashboard = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
  const IconTicket = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
  const IconSettings = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  const IconHelp = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
  const IconPlus = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;

  return (
    <div className="app-container">
      <div className={`sidebar-backdrop ${mobileMenuOpen ? 'open' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>
      <nav className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header flex justify-between items-center">
          <div className="brand-logo">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z" /></svg>
            Ultron Devs
          </div>
          <button className="mobile-header-btn" onClick={() => setMobileMenuOpen(false)} style={{ marginRight: 0 }}>✕</button>
        </div>

        <a className={`nav-link ${view === 'all' ? 'active' : ''}`} onClick={() => handleNavClick('all')}>
          <IconDashboard /> All Tickets
        </a>
        <a className={`nav-link ${view === 'my' ? 'active' : ''}`} onClick={() => handleNavClick('my')}>
          <IconTicket /> My Tickets
        </a>
        <a className={`nav-link ${view === 'contact_us' ? 'active' : ''}`} onClick={() => handleNavClick('contact_us')}>
          <IconHelp /> Contact Us
        </a>

        <div style={{ flex: 1 }}></div>

        <a className={`nav-link ${view === 'settings' ? 'active' : ''}`} onClick={() => handleNavClick('settings')}>
          <IconSettings /> Settings
        </a>
      </nav>

      <main className="main-content">
        <div className="content-wrapper">
          <header className="page-header" style={{ marginBottom: '2rem' }}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <button className="mobile-header-btn" onClick={() => setMobileMenuOpen(true)} style={{ margin: 0 }}>☰</button>
                <div>
                  <h1 className="text-xl">
                    {view === 'all' && 'Ultron Developments IT Solutions'}
                    {view === 'my' && 'My Tickets'}
                    {view === 'contact_us' && 'About Ultron Devs'}
                    {view === 'settings' && 'Settings'}
                  </h1>
                  <p className="page-subtitle">View and manage support requests</p>
                </div>
              </div>

              {(view === 'all' || view === 'my') && (
                <button className="btn" onClick={() => {
                  setEditingTicket({
                    cr76d_tickettitle: '',
                    cr76d_description: '',
                    cr76d_priority: 376340001 as any,
                    cr76d_status: 376340000 as any,
                    cr76d_ticketowner: ''
                  });
                  setIsModalOpen(true);
                }}>
                  <IconPlus /> New Ticket
                </button>
              )}
            </div>
          </header>

          {loading && <p>Loading data...</p>}

          {(view === 'all' || view === 'my') && (
            <>
              <div className="filters-row flex-col-mobile">
                <input
                  className="filter-select"
                  style={{ flex: 1, minWidth: '200px' }}
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                  className="filter-select"
                  value={priorityFilter === undefined ? '' : priorityFilter}
                  onChange={e => {
                    setPriorityFilter(e.target.value ? Number(e.target.value) : undefined);
                    setPage(1);
                    setPageTokens([]);
                  }}
                >
                  <option value="">All Priorities</option>
                  {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select
                  className="filter-select"
                  value={statusFilter === undefined ? '' : statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value ? Number(e.target.value) : undefined);
                    setPage(1);
                    setPageTokens([]);
                  }}
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {(searchTerm || statusFilter !== undefined || priorityFilter !== undefined) && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter(undefined);
                      setPriorityFilter(undefined);
                      setPage(1);
                      setPageTokens([]);
                    }}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Clear Filters
                  </button>
                )}

                <button
                  className="btn-secondary"
                  onClick={() => loadTickets()}
                  title="Refresh List"
                >
                  ↻
                </button>
              </div>

              {fetchError && (
                <div className="card" style={{ border: '1px solid red', color: 'red', padding: '1rem', marginBottom: '1rem' }}>
                  <p><strong>Error loading tickets:</strong> {fetchError}</p>
                  <button className="btn-secondary" onClick={() => loadTickets()} style={{ marginTop: '0.5rem' }}>Retry</button>
                </div>
              )}

              <div className="ticket-list">
                {filteredTickets.map(ticket => (
                  <TicketCard
                    key={ticket.cr76d_ticketid}
                    ticket={ticket}
                    onClick={() => {
                      setEditingTicket(ticket);
                      setIsModalOpen(true);
                    }}
                  />
                ))}
                {!loading && filteredTickets.length === 0 && (
                  <div className="card text-secondary text-center p-4">No tickets found matching your criteria.</div>
                )}

                {/* DEBUG INFO */}
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '1rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px', overflowWrap: 'break-word' }}>
                  <div><strong>Debug Info:</strong></div>
                  <div>Page: {page}</div>
                  <div>Loaded Count: {tickets.length}</div>
                  <div>Has Next Token: {nextLink ? 'Yes' : 'No'}</div>
                  {nextLink && <div>Token: {nextLink.substring(0, 50)}...</div>}
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-center items-center gap-2" style={{ marginTop: '1.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(page - 1)}
                    style={{ minWidth: '40px' }}
                  >
                    &lt;
                  </button>

                  {/* Page Numbers */}
                  {[...Array(Math.max(page, pageTokens.length + 1))].map((_, idx) => {
                    const pNum = idx + 1;
                    // Only show button if it's within known range (tokens + 1)
                    if (pNum > pageTokens.length + 1) return null;

                    return (
                      <button
                        key={pNum}
                        className={`btn-secondary ${page === pNum ? 'active-page' : ''}`}
                        style={{
                          backgroundColor: page === pNum ? 'var(--primary-color)' : 'transparent',
                          color: page === pNum ? 'white' : 'inherit',
                          borderColor: page === pNum ? 'transparent' : 'var(--border-color)',
                          minWidth: '32px',
                          padding: '0 8px'
                        }}
                        onClick={() => setPage(pNum)}
                        disabled={loading}
                      >
                        {pNum}
                      </button>
                    );
                  })}

                  <button
                    className="btn-secondary"
                    disabled={(!nextLink && filteredTickets.length < PAGE_SIZE) || loading}
                    onClick={() => {
                      if (nextLink) {
                        setPageTokens(prev => {
                          const newTokens = [...prev];
                          newTokens[page - 1] = nextLink;
                          return newTokens;
                        });
                        setPage(page + 1);
                      }
                    }}
                    style={{ minWidth: '40px' }}
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </>
          )}

          {view === 'contact_us' && <ContactUsView />}

          {view === 'settings' && (
            <>
              <div className="card">
                <h2 className="text-lg" style={{ marginBottom: '1rem' }}>Preferences</h2>
                <div className="flex items-center gap-4">
                  <label htmlFor="darkmode-toggle" className="font-bold">Dark Mode</label>
                  <input
                    id="darkmode-toggle"
                    type="checkbox"
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                  />
                </div>
              </div>

              <DataSeeder currentUserEmail={currentUserEmail} />
            </>
          )}
        </div>
      </main>

      {isModalOpen && editingTicket && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
              <h2 className="text-xl">
                {editingTicket.cr76d_ticketid ? 'Edit Ticket' : 'New Ticket'}
              </h2>
              <button className="btn-secondary" style={{ padding: '4px 8px', border: 'none' }} onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Subject</label>
              <input
                className="w-full"
                value={editingTicket.cr76d_tickettitle || ''}
                onChange={e => setEditingTicket({ ...editingTicket, cr76d_tickettitle: e.target.value })}
                placeholder="Brief summary of the issue"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="w-full"
                rows={5}
                value={editingTicket.cr76d_description || ''}
                onChange={e => setEditingTicket({ ...editingTicket, cr76d_description: e.target.value })}
                placeholder="Detailed explanation..."
              />
            </div>

            <div className="flex gap-4 form-group flex-col-mobile">
              <div style={{ flex: 1 }}>
                <label className="form-label">Priority</label>
                <select
                  className="w-full"
                  value={editingTicket.cr76d_priority}
                  onChange={e => setEditingTicket({ ...editingTicket, cr76d_priority: Number(e.target.value) as any })}
                >
                  {PRIORITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Status</label>
                <select
                  className="w-full"
                  value={editingTicket.cr76d_status}
                  onChange={e => setEditingTicket({ ...editingTicket, cr76d_status: Number(e.target.value) as any })}
                >
                  {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Assignee</label>
              <UserPicker
                value={editingTicket.cr76d_ticketowner || ''}
                onChange={email => setEditingTicket({ ...editingTicket, cr76d_ticketowner: email })}
              />
            </div>

            <div className="flex justify-end gap-2" style={{ marginTop: '2rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn" onClick={handleSaveTicket} disabled={loading}>
                {loading ? 'Saving...' : 'Save Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TicketCard = ({ ticket, onClick }: { ticket: Cr76d_tickets, onClick: () => void }) => {
  const getPriorityBadgeIdx = (p?: number) => {
    if (p === 376340000) return 'badge-low';
    if (p === 376340001) return 'badge-medium';
    return 'badge-high'; // High
  };

  const getStatusBadgeClass = (s?: number) => {
    if (s === 376340000) return 'badge-status-open'; // Open
    if (s === 376340001) return 'badge-status-inprogress'; // In Progress
    return 'badge-status-closed'; // Closed
  };

  const priorityLabel = PRIORITY_OPTIONS.find(o => o.value === ticket.cr76d_priority)?.label || 'Unknown';
  const statusLabel = STATUS_OPTIONS.find(o => o.value === ticket.cr76d_status)?.label || 'Unknown';

  // Format Date (Mocking a date since usually Dataverse dates are strings)
  const dateStr = ticket.cr76d_createddate ? new Date(ticket.cr76d_createddate).toLocaleDateString() : 'Today';

  return (
    <div className="ticket-card" onClick={onClick}>
      <div className="ticket-header">
        <span className="ticket-id">#{ticket.cr76d_ticketid ? ticket.cr76d_ticketid.substring(0, 6).toUpperCase() : 'TKT'}</span>
        <span className={`badge ${getStatusBadgeClass(ticket.cr76d_status as number)}`}>{statusLabel}</span>
        <span className={`badge ${getPriorityBadgeIdx(ticket.cr76d_priority as number)}`}>{priorityLabel}</span>
      </div>

      <h3 className="ticket-title">{ticket.cr76d_tickettitle}</h3>

      <div className="ticket-meta">
        <span>Support • {dateStr}</span>
        {ticket.cr76d_ticketowner && (
          <div className="flex items-center gap-1">
            <div className="user-avatar-small">
              {ticket.cr76d_ticketowner.substring(0, 1).toUpperCase()}
            </div>
            <span>{ticket.cr76d_ticketowner.split('@')[0]}</span>
          </div>
        )}
      </div>

      <div className="ticket-actions hide-on-mobile">
        <button className="btn-ghost">View Details</button>
      </div>
    </div>
  );
};

const UserPicker = ({ value, onChange }: { value: string, onChange: (email: string) => void }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    if (!search) {
      setResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    // Simple debounce
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await Office365UsersService.SearchUser(search, 5);
        if (res.data) {
          setResults(res.data);
          setShowResults(true);
        }
      } catch (e) {
        console.error(e);
      }
    }, 300);
  }, [search]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="w-full"
        value={value}
        placeholder="Type name to search (e.g. 'John')..."
        onChange={e => {
          onChange(e.target.value);
          setSearch(e.target.value);
        }}
        onFocus={() => {
          if (results.length > 0) setShowResults(true);
        }}
        onBlur={() => {
          setTimeout(() => setShowResults(false), 200);
        }}
      />
      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map(u => (
            <div
              key={u.Id || u.UserPrincipalName}
              className="search-result-item"
              onClick={() => {
                onChange(u.Mail || u.UserPrincipalName || '');
                setShowResults(false);
                setSearch('');
              }}
            >
              <div className="user-avatar-small">
                {u.GivenName ? u.GivenName[0] : ''}{u.Surname ? u.Surname[0] : ''}
              </div>
              <div className="flex flex-col">
                <span className="font-bold">{u.DisplayName}</span>
                <span className="text-sm text-secondary">{u.Mail || u.UserPrincipalName}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ContactUsView = () => {
  return (
    <div className="flex flex-col" style={{ gap: '3rem' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #4338ca 100%)', color: 'white', padding: '3rem' }}>
        <h2 className="text-2xl font-bold" style={{ marginBottom: '1.5rem' }}>Low-Code Platform & Power Apps Development</h2>
        <p style={{ opacity: 0.9, lineHeight: 1.8, maxWidth: '800px', marginBottom: '2.5rem', fontSize: '1.1rem' }}>
          We build canvas apps, model-driven apps, and custom solutions on Microsoft Power Platform—connected to your data, integrated with Microsoft 365.
        </p>
        <div className="flex gap-4 flex-col-mobile">
          <a href="https://ultrondevelopments.com.au/powerapps" target="_blank" rel="noopener noreferrer" className="btn" style={{ backgroundColor: 'white', color: 'var(--primary-color)', textDecoration: 'none', padding: '0.75rem 1.5rem', fontWeight: 'bold' }}>
            Talk to a consultant
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {['Canvas Apps', 'Custom UI & UX', 'Model-driven', 'Dataverse & D365', 'Power Automate', 'Workflows & RPA', 'Integrations'].map(item => (
          <div className="card flex items-center justify-center p-6 text-center font-bold" style={{ padding: '2rem', fontSize: '1rem', minHeight: '120px' }} key={item}>
            {item}
          </div>
        ))}
      </div>

      <h3 className="text-2xl font-bold" style={{ marginTop: '2rem', marginBottom: '1rem' }}>What we deliver</h3>
      <div className="grid gap-8" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="card" style={{ padding: '2rem' }}>
          <h4 className="font-bold text-xl" style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>Canvas Apps</h4>
          <p className="text-secondary" style={{ lineHeight: 1.6 }}>Pixel-perfect custom apps for web and mobile with drag-and-drop design and Excel-like formulas.</p>
        </div>
        <div className="card" style={{ padding: '2rem' }}>
          <h4 className="font-bold text-xl" style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>Model-driven Apps</h4>
          <p className="text-secondary" style={{ lineHeight: 1.6 }}>Data-first applications built on Dataverse with forms, views, and business process flows.</p>
        </div>
        <div className="card" style={{ padding: '2rem' }}>
          <h4 className="font-bold text-xl" style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>Power Automate</h4>
          <p className="text-secondary" style={{ lineHeight: 1.6 }}>Cloud flows, desktop flows (RPA), and AI Builder automations across all your systems.</p>
        </div>
        <div className="card" style={{ padding: '2rem' }}>
          <h4 className="font-bold text-xl" style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>Power Apps Code Apps</h4>
          <p className="text-secondary" style={{ lineHeight: 1.6 }}>Pro-code components (PCF), custom pages, and complex integrations extending Power Platform.</p>
        </div>
      </div>
    </div>
  );
};

export default App;
