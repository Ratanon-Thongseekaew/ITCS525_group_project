import { useState } from 'react'
import { Archive, ArrowDownUp, Calculator, Check, ClipboardList, Shirt, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

type Bin = {
  id: string
  count: number
  weight: number
  packed: string
  status: 'Awaiting Process' | 'Processed'
}

const initialBins: Bin[] = [
  {
    id: 'bin-id-001',
    count: 100,
    weight: 40,
    packed: '3:30 PM, 1 OCT 2026',
    status: 'Awaiting Process',
  },
]

export function DirectResalePage() {
  const [bins, setBins] = useState(initialBins)
  const [activeBin, setActiveBin] = useState<Bin | null>(null)
  const [accepted, setAccepted] = useState('98')
  const [rejected, setRejected] = useState('2')
  const [revenue, setRevenue] = useState('15000')
  const [notes, setNotes] = useState('')
  const [view, setView] = useState<'awaiting' | 'processed' | 'analysis'>('awaiting')
  const [keypadOpen, setKeypadOpen] = useState(false)

  const awaiting = bins.filter((bin) => bin.status === 'Awaiting Process')
  const processed = bins.filter((bin) => bin.status === 'Processed')

  function openProcess(bin: Bin) {
    setActiveBin(bin)
    setAccepted(String(bin.count - 2))
    setRejected('2')
    setRevenue('15000')
    setNotes('')
  }

  function confirmProcess() {
    if (!activeBin) return
    setBins((current) =>
      current.map((bin) => (bin.id === activeBin.id ? { ...bin, status: 'Processed' } : bin)),
    )
    setActiveBin(null)
    setView('processed')
  }

  const displayedBins = view === 'processed' ? processed : awaiting

  return (
    <div className="resale-workspace">
      <aside className="resale-sidebar">
        <a className="resale-brand" href="/direct-resale">
          <span className="resale-brand__icon">
            <Shirt />
          </span>
          <strong>Textile Track</strong>
        </a>
        <span className="resale-sidebar__label">WORKSPACE</span>
        <nav aria-label="Workspace">
          <button type="button" className="resale-nav">
            <ArrowDownUp /> Sorting
          </button>
          <button
            type="button"
            className="resale-nav resale-nav--active"
            onClick={() => setView('awaiting')}
          >
            <Shirt /> Direct Resale
          </button>
          <button type="button" className="resale-nav" onClick={() => setView('processed')}>
            <Archive /> Recycle Bin Handoff
          </button>
        </nav>
        <a className="resale-signout" href="/">
          ↪&nbsp; Sign Out
        </a>
      </aside>

      <main className="resale-main">
        <div className="resale-topline">
          <div>
            <span>Operations</span>
            <span className="resale-slash">/</span>
            <strong>Direct Resale</strong>
          </div>
          <span className="resale-workspace-status">Store Staff workspace</span>
        </div>
        <header className="resale-heading">
          <div>
            <h1>Direct Resale Bins</h1>
            <p>Tap to process resale bin and record potential revenue</p>
          </div>
          <div className="resale-heading__actions">
            <Button variant="outline" onClick={() => setView('analysis')}>
              <ClipboardList /> Potential Revenue Analysis
            </Button>
            <Button variant="outline" onClick={() => setView('processed')}>
              <Archive /> Processed Bin Records
            </Button>
          </div>
        </header>

        {view === 'analysis' ? (
          <section className="resale-content-panel">
            <h2>Potential Revenue Analysis</h2>
            <p className="resale-muted">Revenue recorded from processed direct resale bins.</p>
            <div className="resale-analysis-total">฿{processed.length ? '15,000' : '0'}</div>
            <p>{processed.length} processed bins</p>
            <Button variant="outline" onClick={() => setView('awaiting')}>
              Back to bins
            </Button>
          </section>
        ) : (
          <>
            <section className="resale-summary">
              <h2>Summary</h2>
              <div className="resale-metrics">
                <article>
                  <span>Bins Awaiting</span>
                  <strong>{awaiting.length}</strong>
                </article>
                <article>
                  <span>Items Staged</span>
                  <strong>{awaiting.reduce((sum, bin) => sum + bin.count, 0)}</strong>
                </article>
                <article>
                  <span>Total Grossed Weight</span>
                  <strong>{awaiting.reduce((sum, bin) => sum + bin.weight, 0)} kg</strong>
                </article>
                <article>
                  <span>Bins Processed Today</span>
                  <strong>{processed.length + 3}</strong>
                </article>
              </div>
            </section>
            <section className="resale-bins">
              <h2>{view === 'processed' ? 'Processed bin records' : 'Bins awaiting process'}</h2>
              {displayedBins.length ? (
                displayedBins.map((bin) => (
                  <button
                    className="resale-bin"
                    key={bin.id}
                    onClick={() => bin.status === 'Awaiting Process' && openProcess(bin)}
                    type="button"
                  >
                    <span className="resale-bin__icon">
                      <Shirt />
                    </span>
                    <span className="resale-bin__identity">
                      <strong>#{bin.id}</strong>
                      <b>Direct Resale Bin</b>
                      <small>Packed at&nbsp; {bin.packed}</small>
                    </span>
                    <span className="resale-bin__stat">
                      <small>Item count</small>
                      <strong>{bin.count} items</strong>
                    </span>
                    <span className="resale-bin__stat">
                      <small>Grossed Weight</small>
                      <strong>{bin.weight}kg</strong>
                    </span>
                    <span className="resale-bin__stat">
                      <small>Status</small>
                      <em className={bin.status === 'Processed' ? 'is-processed' : ''}>
                        {bin.status}
                      </em>
                    </span>
                  </button>
                ))
              ) : (
                <div className="resale-empty">No bins in this list.</div>
              )}
              <p className="resale-record-count">
                Showing {displayedBins.length} of {displayedBins.length} records
              </p>
            </section>
          </>
        )}
      </main>

      {activeBin && (
        <div
          className="resale-overlay"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setActiveBin(null)}
        >
          <section
            className="resale-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="process-title"
          >
            <header>
              <h2 id="process-title">Process Resale Bin</h2>
              <button aria-label="Close" onClick={() => setActiveBin(null)} type="button">
                <X />
              </button>
            </header>
            <div className="resale-dialog__body">
              <div className="resale-bin-preview">
                <Shirt />
                <div className="resale-bin-preview__identity">
                  <strong>#{activeBin.id}</strong>
                  <b>Resale Bin</b>
                </div>
                <div>
                  <small>Item Count</small>
                  <strong>{activeBin.count} items</strong>
                </div>
                <div>
                  <small>Grossed Weight</small>
                  <strong>{activeBin.weight}kg</strong>
                </div>
                <p>Packed at&nbsp; {activeBin.packed}</p>
              </div>
              <div className="resale-form-grid">
                <label>
                  Accepted Item Count
                  <Input
                    type="number"
                    min="0"
                    value={accepted}
                    onChange={(event) => setAccepted(event.target.value)}
                  />
                </label>
                <label>
                  Rejected Item Count
                  <Input
                    className="resale-rejected-input"
                    type="number"
                    min="0"
                    value={rejected}
                    onChange={(event) => setRejected(event.target.value)}
                  />
                </label>
                <label>
                  Potential Revenue
                  <div className="resale-currency">
                    <Input
                      type="number"
                      min="0"
                      value={revenue}
                      onChange={(event) => setRevenue(event.target.value)}
                    />
                    <span>฿</span>
                  </div>
                </label>
                <label>
                  Or Use Running-Sum Keypad
                  <Button
                    className="resale-keypad-trigger"
                    variant="secondary"
                    onClick={() => setKeypadOpen(!keypadOpen)}
                  >
                    <Calculator /> {keypadOpen ? 'Close' : 'Open'}
                  </Button>
                </label>
                {keypadOpen && (
                  <div className="resale-keypad" aria-label="Running-sum keypad">
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '+'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          key === 'C'
                            ? setRevenue('0')
                            : key === '+'
                              ? undefined
                              : setRevenue((current) => `${current === '0' ? '' : current}${key}`)
                        }
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                )}
                <label>
                  Process Date
                  <div className="resale-date">
                    <span>▦</span>
                    <Input type="date" defaultValue="2026-10-20" />
                  </div>
                </label>
                <label>
                  Notes <span className="resale-muted">(Optional)</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>
              </div>
              <p className="resale-validation">
                Accepted and rejected item counts should total {activeBin.count} items.
              </p>
            </div>
            <footer>
              <Button
                className="resale-confirm"
                disabled={Number(accepted) + Number(rejected) !== activeBin.count}
                onClick={confirmProcess}
              >
                <Check /> Confirm
              </Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
